import { decodeDataUrl } from "@punchpress/punch-schema";
import { measurePerf } from "../perf/perf-hooks";
import {
  canScheduleRasterFrame,
  createCanvas,
  getNow,
  requestRasterFrame,
} from "../tools/brush-runtime";
import type { RasterAssetStore } from "./raster-asset-store";
import { isPureTiledImageNode } from "./raster-commit";
import {
  enforceRasterMemoryBudget,
  registerEvictableStore,
  scheduleRasterMemoryEnforcement,
  unregisterEvictableStore,
  type EvictableStoreHandle,
} from "./raster-memory";
import { decodePngRgba, peekPngDimensions } from "./raster-png";
import { RasterTilePyramid } from "./raster-pyramid";
import { RasterTileStore } from "./raster-tile-store";

/**
 * Hydration decodes committed tiles on the main thread, so it runs in
 * rAF-cadenced chunks with a small sync budget. Hydration is tile-major and
 * lazy: `ensureHydrated` indexes every payload-covered tile as hollow and
 * streams decodes in the background, while `ensureTilesHydrated` decodes
 * exactly the tiles a stroke's merge is about to write — first contact never
 * waits for the whole layer. Evicted tiles rejoin the hollow set and come
 * back through the same per-tile path.
 */
const HYDRATION_CHUNK_BUDGET_MS = 8;

type Bounds = {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
};

type HydrationSource = {
  height: number;
  ref?: string;
  src?: string;
  width: number;
  x: number;
  y: number;
};

type ImageNodeLike = {
  id: string;
  src?: string;
  tileSources?: Array<{
    height: number;
    ref: string;
    width: number;
    x: number;
    y: number;
  }>;
  [key: string]: unknown;
};

export type RasterStoreEntry = {
  anchorX: number;
  anchorY: number;
  /**
   * Per-node commit serialization. Commits re-encode merged store tiles, so
   * one session's encode chunks must never interleave with the next
   * session's merge on the same store; each commit chains onto the previous
   * one's completion.
   */
  commitQueue: Promise<void>;
  /** Commits queued or running on this store (see hasPendingCommits). */
  pendingCommits: number;
  handle: EvictableStoreHandle;
  hydrated: boolean;
  hydrating: Promise<void> | null;
  /** Shared decoded-image cache for the current hydration wave. */
  imageCache: Map<string, Promise<HTMLImageElement | null>> | null;
  pyramid: RasterTilePyramid | null;
  store: RasterTileStore;
  /** Single-flight per-tile hydration promises keyed by `col:row`. */
  tileHydrations: Map<string, Promise<void>>;
};

export class RasterStoreManager {
  entries = new Map<string, RasterStoreEntry>();
  assets: RasterAssetStore | null;
  onChange: (() => void) | null;
  getNode: ((nodeId: string) => ImageNodeLike | null) | null;
  isNodePinned: ((nodeId: string) => boolean) | null;

  constructor({
    assets = null,
    getNode = null,
    isNodePinned = null,
    onChange = null,
  }: {
    assets?: RasterAssetStore | null;
    getNode?: ((nodeId: string) => ImageNodeLike | null) | null;
    isNodePinned?: ((nodeId: string) => boolean) | null;
    onChange?: (() => void) | null;
  } = {}) {
    this.assets = assets;
    this.getNode = getNode;
    this.isNodePinned = isNodePinned;
    this.onChange = onChange;
  }

  getEntry(nodeId: string) {
    return this.entries.get(nodeId) || null;
  }

  getStore(nodeId: string) {
    return this.entries.get(nodeId)?.store || null;
  }

  getOrCreateEntry(nodeId: string) {
    const existingEntry = this.entries.get(nodeId);

    if (existingEntry) {
      return existingEntry;
    }

    const store = new RasterTileStore();
    const entry: RasterStoreEntry = {
      anchorX: 0,
      anchorY: 0,
      commitQueue: Promise.resolve(),
      handle: {
        isPinned: () =>
          entry.pendingCommits > 0 || Boolean(this.isNodePinned?.(nodeId)),
        prepareEviction: (tile) => {
          // Create the pyramid if it does not exist yet: the evicted tile's
          // level-1 ancestor must hold its content while the pixels are
          // still resident, or zoomed-out rendering loses coverage and
          // falls into a rebuild/rehydrate cycle.
          this.getPyramid(nodeId)?.ensureBaseAncestor(tile.col, tile.row);
        },
        store,
      },
      hydrated: false,
      hydrating: null,
      imageCache: null,
      pendingCommits: 0,
      pyramid: null,
      store,
      tileHydrations: new Map(),
    };

    store.onHollowTileNeeded = (col, row) => {
      this.requestTileHydration(nodeId, col, row);
    };
    this.entries.set(nodeId, entry);
    registerEvictableStore(entry.handle);
    return entry;
  }

  getPyramid(nodeId: string) {
    const entry = this.entries.get(nodeId);

    if (!entry) {
      return null;
    }

    if (!entry.pyramid) {
      entry.pyramid = new RasterTilePyramid(entry.store);
    }

    return entry.pyramid;
  }

  /**
   * Kick full hydration: index every payload-covered tile as hollow, then
   * stream per-tile decodes in the background (viewport-priority first).
   * Resolves when every tile has been visited once; tiles evicted under
   * budget pressure during the drain stay hollow and rehydrate on demand.
   */
  ensureHydrated(
    node: ImageNodeLike,
    { priorityBounds = null }: { priorityBounds?: Bounds | null } = {}
  ) {
    const entry = this.getOrCreateEntry(node.id);

    if (entry.hydrated) {
      return Promise.resolve();
    }

    if (!entry.hydrating) {
      entry.hydrating = this.hydrateAllTiles(entry, node, priorityBounds).then(
        () => {
          entry.hydrated = true;
          entry.hydrating = null;
          entry.imageCache = null;
          this.onChange?.();
        }
      );
    }

    return entry.hydrating;
  }

  /**
   * Decode exactly the hollow tiles intersecting `storeBounds` (store
   * coordinates). The commit merge awaits this before writing — and before
   * its undo capture copies before-rects — so merges and captures always see
   * hydrated content without waiting for the rest of the layer.
   */
  async ensureTilesHydrated(node: ImageNodeLike, storeBounds: Bounds) {
    const entry = this.getOrCreateEntry(node.id);

    this.buildHollowIndex(entry, node);

    const hollow = entry.store.getHollowTilesForBounds(storeBounds);

    if (hollow.length === 0) {
      return;
    }

    const context = this.createHydrationContext(entry, node);
    const yieldIfOverBudget = createHydrationBudget();

    for (const coords of hollow) {
      await this.hydrateTile(entry, context, coords.col, coords.row);
      await yieldIfOverBudget();
    }

    entry.store.revision += 1;
    entry.store.consumeDirtyBounds();
  }

  /**
   * Async per-tile rehydration for render paths that met a hollow tile.
   * Requests enqueue and drain on a frame-budgeted rAF loop — a zoomed-out
   * repaint can request thousands of tiles in one pass, and hydrating them
   * inline would starve the frame with a microtask storm. Repaints follow
   * through onChange as decodes land.
   */
  requestTileHydration(nodeId: string, col: number, row: number) {
    const entry = this.entries.get(nodeId);

    // Only EVICTED tiles rehydrate on demand. Hollow-from-birth tiles are
    // the background hydration drain's worklist; re-requesting them from
    // render paths mid-drain churns notify/re-render cycles for tiles that
    // are already on their way.
    if (!entry?.store.getHollowTile(col, row)?.evicted) {
      return;
    }

    this.pendingTileHydrations.set(`${nodeId}:${col}:${row}`, {
      col,
      nodeId,
      row,
    });
    this.scheduleTileHydrationDrain();
  }

  private pendingTileHydrations = new Map<
    string,
    { col: number; nodeId: string; row: number }
  >();
  private tileHydrationDrainRunning = false;

  private scheduleTileHydrationDrain() {
    if (this.tileHydrationDrainRunning) {
      return;
    }

    this.tileHydrationDrainRunning = true;
    requestRasterFrame(() => {
      this.drainTileHydrations().finally(() => {
        this.tileHydrationDrainRunning = false;

        if (this.pendingTileHydrations.size > 0) {
          this.scheduleTileHydrationDrain();
        }
      });
    });
  }

  private async drainTileHydrations() {
    const yieldIfOverBudget = createHydrationBudget();
    const contexts = new Map<
      string,
      ReturnType<RasterStoreManager["createHydrationContext"]>
    >();
    const touchedEntries = new Set<RasterStoreEntry>();
    let sinceNotify = 0;

    const notifyTouched = () => {
      for (const entry of touchedEntries) {
        entry.store.revision += 1;
        entry.store.consumeDirtyBounds();
      }

      if (touchedEntries.size > 0) {
        touchedEntries.clear();
        this.onChange?.();
      }
    };

    while (this.pendingTileHydrations.size > 0) {
      const [key, request] = this.pendingTileHydrations.entries().next()
        .value as [string, { col: number; nodeId: string; row: number }];

      this.pendingTileHydrations.delete(key);

      const entry = this.entries.get(request.nodeId);
      const node = this.getNode?.(request.nodeId);

      if (!(entry && node && entry.store.isHollow(request.col, request.row))) {
        continue;
      }

      let context = contexts.get(request.nodeId);

      if (!context) {
        context = this.createHydrationContext(entry, node);
        contexts.set(request.nodeId, context);
      }

      await this.hydrateTile(entry, context, request.col, request.row);
      touchedEntries.add(entry);
      sinceNotify += 1;

      if (sinceNotify >= 16) {
        sinceNotify = 0;
        notifyTouched();
        enforceRasterMemoryBudget({ budgetMs: 4 });
      }

      await yieldIfOverBudget();
    }

    notifyTouched();
    scheduleRasterMemoryEnforcement();
  }

  /**
   * True while any store has commits queued or running (merge + encode
   * chunks). Heavy main-thread work outside the engine (autosave packaging)
   * defers on this.
   */
  hasPendingCommits() {
    for (const entry of this.entries.values()) {
      if (entry.pendingCommits > 0) {
        return true;
      }
    }

    return false;
  }

  release(nodeId: string) {
    const entry = this.entries.get(nodeId);

    if (entry) {
      unregisterEvictableStore(entry.handle);
      this.entries.delete(nodeId);
    }
  }

  releaseAll() {
    for (const entry of this.entries.values()) {
      unregisterEvictableStore(entry.handle);
    }

    this.entries.clear();
  }

  private async hydrateAllTiles(
    entry: RasterStoreEntry,
    node: ImageNodeLike,
    priorityBounds: Bounds | null
  ) {
    this.buildHollowIndex(entry, node);

    // Snapshot the keys: tiles evicted mid-drain rejoin the hollow set, and
    // revisiting them here would ping-pong with the budget forever.
    const context = this.createHydrationContext(entry, node);
    const coords = [...entry.store.hollowTiles.values()];
    const tileSize = entry.store.tileSize;
    // Priority bounds arrive in node-local coordinates; tiles compare in
    // store coordinates (offset by the entry anchor).
    const priorityStoreBounds = priorityBounds
      ? {
          maxX: priorityBounds.maxX - entry.anchorX,
          maxY: priorityBounds.maxY - entry.anchorY,
          minX: priorityBounds.minX - entry.anchorX,
          minY: priorityBounds.minY - entry.anchorY,
        }
      : null;
    const inPriority = (tile: { col: number; row: number }) =>
      Boolean(
        priorityStoreBounds &&
          (tile.col + 1) * tileSize > priorityStoreBounds.minX &&
          tile.col * tileSize < priorityStoreBounds.maxX &&
          (tile.row + 1) * tileSize > priorityStoreBounds.minY &&
          tile.row * tileSize < priorityStoreBounds.maxY
      );
    const orderedCoords = priorityBounds
      ? [...coords.filter(inPriority), ...coords.filter((c) => !inPriority(c))]
      : coords;
    const yieldIfOverBudget = createHydrationBudget();

    for (const tileCoords of orderedCoords) {
      await this.hydrateTile(entry, context, tileCoords.col, tileCoords.row);
      await yieldIfOverBudget();
      enforceRasterMemoryBudget({ budgetMs: 4 });
    }

    entry.store.revision += 1;
    entry.store.consumeDirtyBounds();
  }

  /**
   * Index every source-covered tile as hollow so lazy and on-demand
   * hydration share one worklist. Cheap and idempotent: resident tiles are
   * skipped, already-indexed keys overwrite in place.
   */
  private buildHollowIndex(entry: RasterStoreEntry, node: ImageNodeLike) {
    const store = entry.store;

    for (const source of this.getHydrationSources(entry, node)) {
      const bounds = {
        maxX: source.x + source.width - entry.anchorX,
        maxY: source.y + source.height - entry.anchorY,
        minX: source.x - entry.anchorX,
        minY: source.y - entry.anchorY,
      };
      const minCol = Math.floor((bounds.minX - store.gutter) / store.tileSize);
      const maxCol = Math.floor(
        (Math.ceil(bounds.maxX) - 1 + store.gutter) / store.tileSize
      );
      const minRow = Math.floor((bounds.minY - store.gutter) / store.tileSize);
      const maxRow = Math.floor(
        (Math.ceil(bounds.maxY) - 1 + store.gutter) / store.tileSize
      );

      for (let row = minRow; row <= maxRow; row += 1) {
        for (let col = minCol; col <= maxCol; col += 1) {
          store.markHollowTile(col, row);
        }
      }
    }
  }

  private getHydrationSources(
    entry: RasterStoreEntry,
    node: ImageNodeLike
  ): HydrationSource[] {
    const sources: HydrationSource[] = [];

    if (node.src) {
      sources.push({
        height: (node.baseHeight as number) ?? (node.height as number),
        src: node.src,
        width: (node.baseWidth as number) ?? (node.width as number),
        x: (node.baseX as number) ?? 0,
        y: (node.baseY as number) ?? 0,
      });
    }

    for (const tileSource of node.tileSources || []) {
      if (!this.assets?.has(tileSource.ref)) {
        continue;
      }

      sources.push({
        height: tileSource.height,
        ref: tileSource.ref,
        width: tileSource.width,
        x: tileSource.x,
        y: tileSource.y,
      });
    }

    return sources;
  }

  private createHydrationContext(
    entry: RasterStoreEntry,
    node: ImageNodeLike
  ) {
    const sources = this.getHydrationSources(entry, node);
    // Pure-tiled nodes have exactly one self-complete payload per store
    // tile; hydrating a tile from its own payload alone reproduces the
    // committed pixels byte-for-byte (including the gutter band), where
    // blending every gutter-overlapping neighbor payload would
    // double-composite semi-transparent pixels. The by-key index also keeps
    // per-tile source resolution O(1) — filtering the full source list per
    // tile is quadratic on fully-brushed layers.
    const pureTiled =
      !node.src &&
      isPureTiledImageNode(node as never, {
        anchorX: entry.anchorX,
        anchorY: entry.anchorY,
      });
    const sourcesByKey = pureTiled ? new Map<string, HydrationSource>() : null;

    if (sourcesByKey) {
      const store = entry.store;

      for (const source of sources) {
        const col = Math.floor(
          (source.x - entry.anchorX + store.gutter) / store.tileSize
        );
        const row = Math.floor(
          (source.y - entry.anchorY + store.gutter) / store.tileSize
        );

        sourcesByKey.set(`${col}:${row}`, source);
      }
    }

    return { entry, pureTiled, sources, sourcesByKey };
  }

  private hydrateTile(
    entry: RasterStoreEntry,
    context: {
      pureTiled: boolean;
      sources: HydrationSource[];
      sourcesByKey: Map<string, HydrationSource> | null;
    },
    col: number,
    row: number
  ) {
    const key = `${col}:${row}`;
    const inFlight = entry.tileHydrations.get(key);

    if (inFlight) {
      return inFlight;
    }

    if (!entry.store.isHollow(col, row)) {
      return Promise.resolve();
    }

    const hydration = this.hydrateTileFromSources(entry, context, col, row)
      .catch(() => undefined)
      .then(() => {
        entry.tileHydrations.delete(key);
      });

    entry.tileHydrations.set(key, hydration);
    return hydration;
  }

  private async hydrateTileFromSources(
    entry: RasterStoreEntry,
    context: {
      pureTiled: boolean;
      sources: HydrationSource[];
      sourcesByKey: Map<string, HydrationSource> | null;
    },
    col: number,
    row: number
  ) {
    const store = entry.store;
    const tileRect = {
      maxX: (col + 1) * store.tileSize + store.gutter,
      maxY: (row + 1) * store.tileSize + store.gutter,
      minX: col * store.tileSize - store.gutter,
      minY: row * store.tileSize - store.gutter,
    };
    // Pure-tiled: only the tile's own payload, resolved O(1) by store key.
    const ownSource = context.sourcesByKey?.get(`${col}:${row}`);
    const sources = context.sourcesByKey
      ? ownSource
        ? [ownSource]
        : []
      : context.sources.filter((source) => {
          const minX = source.x - entry.anchorX;
          const minY = source.y - entry.anchorY;

          return !(
            minX >= tileRect.maxX ||
            minY >= tileRect.maxY ||
            minX + source.width <= tileRect.minX ||
            minY + source.height <= tileRect.minY
          );
        });

    // An evicted tile's content is still present in the pyramid (its
    // level-1 ancestor was built at eviction time), and the raw decode path
    // restores the exact bytes — so rehydration need not re-dirty the
    // pyramid, which would otherwise churn zoomed-out rebuilds forever
    // under budget pressure.
    const byteExactRestore = Boolean(
      context.pureTiled && store.getHollowTile(col, row)?.evicted
    );
    let hydratedAny = false;
    let skippedPendingSource = false;

    for (const source of sources) {
      // A payload still encoding in the worker has no bytes to decode yet;
      // keep the hollow marker so the tile retries once the encode lands.
      if (source.ref && this.assets?.get(source.ref)?.pending) {
        skippedPendingSource = true;
        continue;
      }
      // The raw path is a straight blit: it only applies when the payload's
      // natural size matches its manifest rect (always true for this
      // engine's commits). Scaled payloads (legacy/synthetic manifests)
      // take the image path, which resamples via drawImage; the dimension
      // peek rejects them before paying for a full decode.
      const rawDecoded = source.ref
        ? await this.decodeRawSource(source.ref, source.width, source.height)
        : null;

      if (rawDecoded) {
        hydratedAny =
          measurePerf("raster.hydrate.blit", () =>
            blendPixelsIntoTile({
              entry,
              height: rawDecoded.height,
              pixels: rawDecoded.pixels,
              skipPyramidDirty: byteExactRestore,
              sourceX: source.x - entry.anchorX,
              sourceY: source.y - entry.anchorY,
              store,
              tileRect,
              width: rawDecoded.width,
            })
          ) || hydratedAny;
        continue;
      }

      hydratedAny =
        (await this.blendImageSourceIntoTile(entry, source, tileRect)) ||
        hydratedAny;
    }

    if (!(hydratedAny || skippedPendingSource)) {
      // Nothing landed (blank region or missing payloads): the tile owns no
      // content, so drop it from the worklist.
      store.clearHollowTile(col, row);
    }
  }

  /**
   * Byte-exact decode for payloads this engine encoded (8-bit RGB/RGBA
   * PNG). Bypasses canvas image decode — which premultiplies alpha and
   * wobbles RGB under low alpha — so evict-then-rehydrate preserves pixel
   * identity. Non-PNG or exotic payloads return null and take the image
   * path.
   */
  private async decodeRawSource(
    ref: string,
    expectedWidth: number,
    expectedHeight: number
  ) {
    const entry = this.assets?.get(ref);

    if (!entry || entry.pending || entry.mimeType !== "image/png") {
      return null;
    }

    const bytes = this.assets?.getBytes(ref);

    if (!bytes) {
      return null;
    }

    const dimensions = peekPngDimensions(bytes);

    if (
      dimensions?.width !== expectedWidth ||
      dimensions?.height !== expectedHeight
    ) {
      return null;
    }

    try {
      return await decodePngRgba(bytes);
    } catch {
      return null;
    }
  }

  private async blendImageSourceIntoTile(
    entry: RasterStoreEntry,
    source: HydrationSource,
    tileRect: Bounds
  ) {
    const image = await this.loadImageForSource(entry, source);

    if (!image) {
      return false;
    }

    const naturalWidth = image.naturalWidth || image.width || 1;
    const naturalHeight = image.naturalHeight || image.height || 1;
    const scaleX = source.width / naturalWidth;
    const scaleY = source.height / naturalHeight;
    const sourceMinX = source.x - entry.anchorX;
    const sourceMinY = source.y - entry.anchorY;
    const minX = Math.max(tileRect.minX, Math.floor(sourceMinX));
    const minY = Math.max(tileRect.minY, Math.floor(sourceMinY));
    const maxX = Math.min(tileRect.maxX, Math.ceil(sourceMinX + source.width));
    const maxY = Math.min(tileRect.maxY, Math.ceil(sourceMinY + source.height));
    const width = maxX - minX;
    const height = maxY - minY;

    if (width <= 0 || height <= 0) {
      return false;
    }

    return measurePerf("raster.hydrate.imageBlit", () => {
      const scratchContext = getHydrationScratchContext(width, height);

      if (!scratchContext) {
        return false;
      }

      scratchContext.clearRect(0, 0, width, height);
      scratchContext.drawImage(
        image,
        (minX - sourceMinX) / scaleX,
        (minY - sourceMinY) / scaleY,
        width / scaleX,
        height / scaleY,
        0,
        0,
        width,
        height
      );

      const imageData = scratchContext.getImageData(0, 0, width, height);

      if (!hasVisibleAlpha(imageData)) {
        return false;
      }

      const store = entry.store;
      const tile = store.getOrCreateTile(
        Math.floor((tileRect.minX + store.gutter) / store.tileSize),
        Math.floor((tileRect.minY + store.gutter) / store.tileSize)
      );

      blendImageDataOverTile(tile, imageData, minX - tile.x, minY - tile.y);
      tile.revision += 1;
      store.markTileDirtyForPyramid(tile);
      return true;
    });
  }

  private loadImageForSource(
    entry: RasterStoreEntry,
    source: HydrationSource
  ): Promise<CanvasImageSource | null> {
    const cacheKey = source.ref || `src:${source.src?.slice(0, 64)}`;

    entry.imageCache ??= new Map();

    const cached = entry.imageCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const promise = (async () => {
      // Large multi-tile sources (imported photos) pre-rasterize once to a
      // CPU canvas: per-tile drawImage from a large image element
      // re-decodes the whole source per call — measured ~600 ms PER TILE on
      // a 12400x10800 base. createImageBitmap decodes off the main thread,
      // and the bitmap rasterizes to the canvas in budgeted strips.
      const rasterized = await this.rasterizeLargeSource(source);

      if (rasterized) {
        return rasterized;
      }

      if (source.src) {
        return loadImageElement(source.src);
      }

      if (!source.ref) {
        return null;
      }

      const assetEntry = this.assets?.get(source.ref);

      if (assetEntry?.dataUrl) {
        return loadImageElement(assetEntry.dataUrl);
      }

      const objectUrl = this.assets?.getObjectUrl(source.ref);

      return objectUrl ? loadImageElement(objectUrl) : null;
    })();

    entry.imageCache.set(cacheKey, promise);
    return promise;
  }

  private async rasterizeLargeSource(
    source: HydrationSource
  ): Promise<HTMLCanvasElement | null> {
    if (
      typeof createImageBitmap !== "function" ||
      typeof fetch !== "function"
    ) {
      return null;
    }

    const area = source.width * source.height;

    if (
      area < LARGE_SOURCE_RASTERIZE_MIN_PX ||
      area > LARGE_SOURCE_RASTERIZE_MAX_PX
    ) {
      return null;
    }

    try {
      // Data URLs decode through the native base64 fast path — fetch() of a
      // multi-megabyte data URL parses it synchronously on the main thread
      // (measured ~350 ms on a 12400x10800 base).
      let blob: Blob | null = null;

      if (source.src?.startsWith("data:")) {
        const { bytes, mimeType } = decodeDataUrl(source.src);

        blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
      } else if (source.ref) {
        const bytes = this.assets?.getBytes(source.ref);
        const assetEntry = this.assets?.get(source.ref);

        if (bytes && assetEntry) {
          blob = new Blob([bytes as unknown as BlobPart], {
            type: assetEntry.mimeType,
          });
        }
      } else if (source.src) {
        blob = await (await fetch(source.src)).blob();
      }

      if (!blob) {
        return null;
      }

      const bitmap = await createImageBitmap(blob);
      const canvas = createCanvas(bitmap.width, bitmap.height);
      const context = canvas?.getContext("2d", { willReadFrequently: true });

      if (!(canvas && context)) {
        bitmap.close();
        return null;
      }

      // Strip-wise raster into the CPU canvas so no single chunk owns a
      // long frame.
      const yieldIfOverBudget = createHydrationBudget();

      for (let y = 0; y < bitmap.height; y += LARGE_SOURCE_STRIP_ROWS) {
        const stripHeight = Math.min(LARGE_SOURCE_STRIP_ROWS, bitmap.height - y);

        context.drawImage(
          bitmap,
          0,
          y,
          bitmap.width,
          stripHeight,
          0,
          y,
          bitmap.width,
          stripHeight
        );
        await yieldIfOverBudget();
      }

      bitmap.close();
      return canvas;
    } catch {
      return null;
    }
  }
}

/** Pre-rasterize sources spanning at least this many pixels (~16 tiles). */
const LARGE_SOURCE_RASTERIZE_MIN_PX = 16 * 512 * 512;
/** ...but not so large the staging canvas itself is unreasonable (~200 MP). */
const LARGE_SOURCE_RASTERIZE_MAX_PX = 200_000_000;
const LARGE_SOURCE_STRIP_ROWS = 512;

/**
 * Shared scratch canvas for image-path hydration blits. Hydrating a large
 * layer touches thousands of tiles; per-tile canvas allocation churns ~1 MB
 * of backing store each and pressures GC mid-drain.
 */
let hydrationScratchCanvas: HTMLCanvasElement | null = null;
let hydrationScratchContext: CanvasRenderingContext2D | null = null;

const getHydrationScratchContext = (width: number, height: number) => {
  if (!hydrationScratchContext) {
    hydrationScratchCanvas = createCanvas(width, height);
    hydrationScratchContext =
      hydrationScratchCanvas?.getContext("2d", {
        willReadFrequently: true,
      }) || null;

    if (!hydrationScratchContext) {
      return null;
    }
  }

  if (
    hydrationScratchCanvas &&
    (hydrationScratchCanvas.width < width ||
      hydrationScratchCanvas.height < height)
  ) {
    hydrationScratchCanvas.width = Math.max(
      width,
      hydrationScratchCanvas.width
    );
    hydrationScratchCanvas.height = Math.max(
      height,
      hydrationScratchCanvas.height
    );
  }

  return hydrationScratchContext;
};

const createHydrationBudget = () => {
  const budget = { startedAt: getNow() };

  return async () => {
    if (
      !canScheduleRasterFrame() ||
      getNow() - budget.startedAt < HYDRATION_CHUNK_BUDGET_MS
    ) {
      return;
    }

    await new Promise((resolve) => {
      requestRasterFrame(() => resolve(undefined));
    });
    budget.startedAt = getNow();
  };
};

/**
 * Resolve a hydration image element. `image.decode()` is awaited so the full
 * bitmap decode happens off the main thread before any drawImage — the first
 * drawImage of a large undecoded image otherwise decodes synchronously
 * (measured ~2.1 s on a 12400x10800 base) inside a hydration chunk.
 */
const loadImageElement = async (src: string) => {
  if (typeof Image === "undefined" || !src) {
    return null;
  }

  const image = await new Promise<HTMLImageElement | null>((resolve) => {
    const element = new Image();

    element.addEventListener("error", () => resolve(null));
    element.addEventListener("load", () => resolve(element));
    element.src = src;
  });

  if (image && typeof image.decode === "function") {
    await image.decode().catch(() => undefined);
  }

  return image;
};

const hasVisibleAlpha = (imageData: ImageData) => {
  for (let offset = 3; offset < imageData.data.length; offset += 4) {
    if (imageData.data[offset] !== 0) {
      return true;
    }
  }

  return false;
};

/**
 * Straight-copy/blend raw decoded payload pixels into the one tile covered
 * by `tileRect`, clipped to the intersection. Fresh (blank) target regions
 * take a straight copy so rehydration is byte-exact; occupied pixels blend
 * source-over like image hydration.
 */
const blendPixelsIntoTile = ({
  entry,
  height,
  pixels,
  skipPyramidDirty = false,
  sourceX,
  sourceY,
  store,
  tileRect,
  width,
}: {
  entry: RasterStoreEntry;
  height: number;
  pixels: Uint8ClampedArray;
  skipPyramidDirty?: boolean;
  sourceX: number;
  sourceY: number;
  store: RasterTileStore;
  tileRect: Bounds;
  width: number;
}) => {
  const minX = Math.max(tileRect.minX, Math.floor(sourceX));
  const minY = Math.max(tileRect.minY, Math.floor(sourceY));
  const maxX = Math.min(tileRect.maxX, Math.floor(sourceX) + width);
  const maxY = Math.min(tileRect.maxY, Math.floor(sourceY) + height);

  if (maxX <= minX || maxY <= minY) {
    return false;
  }

  const col = Math.floor((tileRect.minX + store.gutter) / store.tileSize);
  const row = Math.floor((tileRect.minY + store.gutter) / store.tileSize);
  const tile = store.getOrCreateTile(col, row);
  let hasContent = false;

  for (let y = minY; y < maxY; y += 1) {
    const sourceRow = y - Math.floor(sourceY);
    const targetRow = y - tile.y;

    for (let x = minX; x < maxX; x += 1) {
      const sourceOffset = (sourceRow * width + (x - Math.floor(sourceX))) * 4;
      const sourceAlpha = pixels[sourceOffset + 3];
      const targetOffset = (targetRow * tile.width + (x - tile.x)) * 4;
      const targetAlphaByte = tile.pixels[targetOffset + 3];

      // Blank target pixels take a straight 4-channel copy — including
      // zero-alpha pixels, whose RGB the store legitimately carries (erase
      // reduces alpha but keeps color). This is what makes rehydration
      // byte-exact against the pre-eviction pixels.
      if (targetAlphaByte === 0) {
        tile.pixels[targetOffset] = pixels[sourceOffset];
        tile.pixels[targetOffset + 1] = pixels[sourceOffset + 1];
        tile.pixels[targetOffset + 2] = pixels[sourceOffset + 2];
        tile.pixels[targetOffset + 3] = sourceAlpha;
        hasContent = hasContent || sourceAlpha > 0;
        continue;
      }

      if (sourceAlpha === 0) {
        continue;
      }

      hasContent = true;

      const alpha = sourceAlpha / 255;
      const targetAlpha = targetAlphaByte / 255;
      const outputAlpha = alpha + targetAlpha * (1 - alpha);

      for (let channel = 0; channel < 3; channel += 1) {
        const sourceChannel = pixels[sourceOffset + channel] / 255;
        const targetChannel = tile.pixels[targetOffset + channel] / 255;

        tile.pixels[targetOffset + channel] = Math.round(
          ((sourceChannel * alpha + targetChannel * targetAlpha * (1 - alpha)) /
            outputAlpha) *
            255
        );
      }

      tile.pixels[targetOffset + 3] = Math.round(outputAlpha * 255);
    }
  }

  tile.revision += 1;

  if (!skipPyramidDirty) {
    store.markTileDirtyForPyramid(tile);
  }

  return hasContent;
};

const blendImageDataOverTile = (
  tile: { pixels: Uint8ClampedArray; width: number },
  imageData: ImageData,
  offsetX: number,
  offsetY: number
) => {
  const source = imageData.data;

  for (let y = 0; y < imageData.height; y += 1) {
    for (let x = 0; x < imageData.width; x += 1) {
      const sourceOffset = (y * imageData.width + x) * 4;
      const sourceAlpha = source[sourceOffset + 3] / 255;

      if (sourceAlpha === 0) {
        continue;
      }

      const targetOffset = ((y + offsetY) * tile.width + (x + offsetX)) * 4;
      const targetAlpha = tile.pixels[targetOffset + 3] / 255;
      const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);

      for (let channel = 0; channel < 3; channel += 1) {
        const sourceChannel = source[sourceOffset + channel] / 255;
        const targetChannel = tile.pixels[targetOffset + channel] / 255;

        tile.pixels[targetOffset + channel] = Math.round(
          ((sourceChannel * sourceAlpha +
            targetChannel * targetAlpha * (1 - sourceAlpha)) /
            outputAlpha) *
            255
        );
      }

      tile.pixels[targetOffset + 3] = Math.round(outputAlpha * 255);
    }
  }
};
