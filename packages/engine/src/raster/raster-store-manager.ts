import {
  canScheduleRasterFrame,
  createCanvas,
  getNow,
  requestRasterFrame,
} from "../tools/brush-runtime";
import type { RasterAssetStore } from "./raster-asset-store";
import { RasterTilePyramid } from "./raster-pyramid";
import { RasterTileStore } from "./raster-tile-store";

/**
 * Hydration decodes committed tiles on the main thread, so it runs in
 * rAF-cadenced chunks with a small sync budget: painting proceeds against the
 * stroke buffer while tiles stream in, and only the commit merge awaits the
 * full hydration promise.
 */
const HYDRATION_CHUNK_BUDGET_MS = 8;

type HydrationBounds = {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
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
  hydrated: boolean;
  hydrating: Promise<void> | null;
  pyramid: RasterTilePyramid | null;
  store: RasterTileStore;
};

export class RasterStoreManager {
  entries = new Map<string, RasterStoreEntry>();
  assets: RasterAssetStore | null;
  onChange: (() => void) | null;

  constructor({
    assets = null,
    onChange = null,
  }: {
    assets?: RasterAssetStore | null;
    onChange?: (() => void) | null;
  } = {}) {
    this.assets = assets;
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

    const entry: RasterStoreEntry = {
      anchorX: 0,
      anchorY: 0,
      commitQueue: Promise.resolve(),
      hydrated: false,
      pendingCommits: 0,
      hydrating: null,
      pyramid: null,
      store: new RasterTileStore(),
    };
    this.entries.set(nodeId, entry);
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

  ensureHydrated(
    node: { id: string },
    { priorityBounds = null }: { priorityBounds?: HydrationBounds | null } = {}
  ) {
    const entry = this.getOrCreateEntry(node.id);

    if (entry.hydrated) {
      return Promise.resolve();
    }

    if (!entry.hydrating) {
      entry.hydrating = hydrateStoreFromNode(
        entry.store,
        node,
        this.assets,
        priorityBounds
      ).then(() => {
        entry.hydrated = true;
        entry.hydrating = null;
        this.onChange?.();
      });
    }

    return entry.hydrating;
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
    this.entries.delete(nodeId);
  }

  releaseAll() {
    this.entries.clear();
  }
}

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

const intersectsBounds = (source, bounds: HydrationBounds) =>
  source.x < bounds.maxX &&
  source.x + source.width > bounds.minX &&
  source.y < bounds.maxY &&
  source.y + source.height > bounds.minY;

const hydrateStoreFromNode = async (
  store: RasterTileStore,
  node,
  assets: RasterAssetStore | null,
  priorityBounds: HydrationBounds | null
) => {
  const sources = [];

  if (node.src) {
    sources.push({
      height: node.baseHeight ?? node.height,
      src: node.src,
      width: node.baseWidth ?? node.width,
      x: node.baseX ?? 0,
      y: node.baseY ?? 0,
    });
  }

  for (const tileSource of node.tileSources || []) {
    if (!assets?.has(tileSource.ref)) {
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

  // Viewport-intersecting tiles hydrate first so what the user is painting
  // over becomes correct soonest.
  const orderedSources = priorityBounds
    ? [
        ...sources.filter((source) => intersectsBounds(source, priorityBounds)),
        ...sources.filter(
          (source) => !intersectsBounds(source, priorityBounds)
        ),
      ]
    : sources;
  const yieldIfOverBudget = createHydrationBudget();

  for (const source of orderedSources) {
    await hydrateImageSource(store, source, assets, yieldIfOverBudget);
  }

  store.consumeDirtyBounds();
};

const loadImageElement = (src) => {
  if (typeof Image === "undefined" || !src) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const image = new Image();

    image.addEventListener("error", () => resolve(null));
    image.addEventListener("load", () => resolve(image));
    image.src = src;
  });
};

const hasVisibleAlpha = (imageData) => {
  for (let offset = 3; offset < imageData.data.length; offset += 4) {
    if (imageData.data[offset] !== 0) {
      return true;
    }
  }

  return false;
};

/**
 * Resolve a hydration source to a decodable image. Manifest tiles (ref) whose
 * asset-store entry is still an undecoded data URL load straight off that
 * string (Image.src accepts a data URL directly — zero base64→byte decode).
 * Once an entry has been decoded to bytes, tiles load through the asset
 * store's content-deduped object URLs instead, so tiles with identical
 * payloads share one browser-cached decode. Inline base payloads (src) load
 * directly.
 */
const loadImageForSource = (source, assets: RasterAssetStore | null) => {
  if (source.src) {
    return loadImageElement(source.src);
  }

  if (!source.ref) {
    return Promise.resolve(null);
  }

  const entry = assets?.get(source.ref);

  if (entry?.dataUrl) {
    return loadImageElement(entry.dataUrl);
  }

  const objectUrl = assets?.getObjectUrl(source.ref);

  return objectUrl ? loadImageElement(objectUrl) : Promise.resolve(null);
};

const hydrateImageSource = async (store, source, assets, yieldIfOverBudget) => {
  const image = await loadImageForSource(source, assets);

  if (!image) {
    return;
  }

  const naturalWidth = image.naturalWidth || image.width || 1;
  const naturalHeight = image.naturalHeight || image.height || 1;
  const scaleX = source.width / naturalWidth;
  const scaleY = source.height / naturalHeight;
  const bounds = {
    maxX: source.x + source.width,
    maxY: source.y + source.height,
    minX: source.x,
    minY: source.y,
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
      await yieldIfOverBudget();

      const tileX = col * store.tileSize - store.gutter;
      const tileY = row * store.tileSize - store.gutter;
      const tileWidth = store.tileSize + store.gutter * 2;
      const tileHeight = store.tileSize + store.gutter * 2;
      const minX = Math.max(tileX, Math.floor(bounds.minX));
      const minY = Math.max(tileY, Math.floor(bounds.minY));
      const maxX = Math.min(tileX + tileWidth, Math.ceil(bounds.maxX));
      const maxY = Math.min(tileY + tileHeight, Math.ceil(bounds.maxY));
      const width = maxX - minX;
      const height = maxY - minY;

      if (width <= 0 || height <= 0) {
        continue;
      }

      const scratch = createCanvas(width, height);
      const scratchContext = scratch?.getContext("2d", {
        willReadFrequently: true,
      });

      if (!scratchContext) {
        continue;
      }

      scratchContext.drawImage(
        image,
        (minX - source.x) / scaleX,
        (minY - source.y) / scaleY,
        width / scaleX,
        height / scaleY,
        0,
        0,
        width,
        height
      );

      const imageData = scratchContext.getImageData(0, 0, width, height);

      if (!hasVisibleAlpha(imageData)) {
        continue;
      }

      const tile = store.getOrCreateTile(col, row);

      blendImageDataOverTile(tile, imageData, minX - tile.x, minY - tile.y);
      tile.revision += 1;
      store.markTileDirtyForPyramid(tile);
    }
  }

  store.revision += 1;
};

const blendImageDataOverTile = (tile, imageData, offsetX, offsetY) => {
  const source = imageData.data;

  for (let y = 0; y < imageData.height; y += 1) {
    for (let x = 0; x < imageData.width; x += 1) {
      const sourceOffset = (y * imageData.width + x) * 4;
      const sourceAlpha = source[sourceOffset + 3] / 255;

      if (sourceAlpha === 0) {
        continue;
      }

      const targetOffset =
        ((y + offsetY) * tile.width + (x + offsetX)) * 4;
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
