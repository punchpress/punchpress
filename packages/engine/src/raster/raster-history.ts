import { incrementPerfCounter } from "../perf/perf-hooks";
import type { RasterStoreEntry } from "./raster-store-manager";
import {
  mergeStrokeStore,
  type RasterStoreTile,
  type RasterTileStore,
} from "./raster-tile-store";

/**
 * How many raster commits keep tile deltas. Undoing past the cap falls back
 * to releasing the affected node's store entry (rehydrate on next contact).
 */
export const RASTER_HISTORY_DEPTH = 20;

/**
 * Retained-bytes budget across all kept steps (before-rect copies plus
 * retained stroke buffers). A huge stroke retains ~218 MB, so the count cap
 * alone could hold multiple gigabytes; over budget the oldest steps evict
 * first, through the same release fallback as depth eviction.
 */
export const RASTER_HISTORY_BYTES_BUDGET = 256 * 1024 * 1024;

type Bounds = { maxX: number; maxY: number; minX: number; minY: number };

type AnchorPoint = { x: number; y: number };

export type RasterTileDelta = {
  /**
   * Copy of the target tile's pixels inside `rect` taken before the commit
   * merge first wrote them. `null` marks a tile the merge created: its before
   * state is fully transparent, so undo zero-fills `rect` instead of storing
   * a buffer of zeros.
   */
  beforePixels: Uint8ClampedArray | null;
  col: number;
  /** Tile-local pixel rect (exclusive max), same shape as tile syncRects. */
  rect: Bounds;
  row: number;
};

export type RasterStrokeCapture = {
  /** Store entry anchor at merge time; undo restores it. */
  anchorBefore: AnchorPoint;
  /** Bytes held by beforePixels copies (stroke-store bytes added at record). */
  bytes: number;
  /** Anchor arguments the commit merge ran with; redo re-merges with them. */
  mergeAnchorX: number;
  mergeAnchorY: number;
  operation: "erase" | "paint";
  tiles: RasterTileDelta[];
};

export type RasterHistoryStep = RasterStrokeCapture & {
  /** Store entry anchor after the commit (rebasing commits shift it). */
  anchorAfter: AnchorPoint;
  historyStepId: number;
  nodeId: string;
  /** The stroke session's sparse stroke buffer, retained for redo re-merge. */
  strokeStore: RasterTileStore;
};

const unionBounds = (current: Bounds | null, next: Bounds): Bounds =>
  current
    ? {
        maxX: Math.max(current.maxX, next.maxX),
        maxY: Math.max(current.maxY, next.maxY),
        minX: Math.min(current.minX, next.minX),
        minY: Math.min(current.minY, next.minY),
      }
    : next;

const copyTileRect = (tile: RasterStoreTile, rect: Bounds) => {
  const width = rect.maxX - rect.minX;
  const height = rect.maxY - rect.minY;
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const sourceOffset = ((rect.minY + y) * tile.width + rect.minX) * 4;

    pixels.set(
      tile.pixels.subarray(sourceOffset, sourceOffset + width * 4),
      y * width * 4
    );
  }

  return pixels;
};

const writeTileRect = (
  tile: RasterStoreTile,
  rect: Bounds,
  pixels: Uint8ClampedArray | null
) => {
  const width = rect.maxX - rect.minX;
  const height = rect.maxY - rect.minY;

  for (let y = 0; y < height; y += 1) {
    const targetOffset = ((rect.minY + y) * tile.width + rect.minX) * 4;

    if (pixels) {
      tile.pixels.set(
        pixels.subarray(y * width * 4, (y + 1) * width * 4),
        targetOffset
      );
    } else {
      tile.pixels.fill(0, targetOffset, targetOffset + width * 4);
    }
  }
};

export const createStrokeCapture = ({
  anchorBefore,
  mergeAnchorX,
  mergeAnchorY,
  operation,
}: {
  anchorBefore: AnchorPoint;
  mergeAnchorX: number;
  mergeAnchorY: number;
  operation: "erase" | "paint";
}): RasterStrokeCapture => ({
  anchorBefore,
  bytes: 0,
  mergeAnchorX,
  mergeAnchorY,
  operation,
  tiles: [],
});

/**
 * Copy-on-first-write capture for one stroke tile's merge, called immediately
 * before mergeStrokeStoreTile writes it. The write region per target tile is
 * the intersection of the tile's physical (gutter-extended) extent with the
 * stroke tile's merged nominal rect — the same math the merge unions into
 * syncRects. Stroke tiles have disjoint nominal rects, so captures from
 * different stroke tiles never overlap within one commit and each captured
 * sub-rect really is pre-first-write.
 */
export const captureTileDeltasBeforeMerge = ({
  anchorX,
  anchorY,
  capture,
  store,
  strokeTile,
}: {
  anchorX: number;
  anchorY: number;
  capture: RasterStrokeCapture;
  store: RasterTileStore;
  strokeTile: RasterStoreTile;
}) => {
  const mergedStoreRect = {
    maxX: strokeTile.nominalX + strokeTile.nominalWidth - anchorX,
    maxY: strokeTile.nominalY + strokeTile.nominalHeight - anchorY,
    minX: strokeTile.nominalX - anchorX,
    minY: strokeTile.nominalY - anchorY,
  };
  const minCol = Math.floor(
    (Math.floor(mergedStoreRect.minX) - store.gutter) / store.tileSize
  );
  const maxCol = Math.floor(
    (Math.ceil(mergedStoreRect.maxX) - 1 + store.gutter) / store.tileSize
  );
  const minRow = Math.floor(
    (Math.floor(mergedStoreRect.minY) - store.gutter) / store.tileSize
  );
  const maxRow = Math.floor(
    (Math.ceil(mergedStoreRect.maxY) - 1 + store.gutter) / store.tileSize
  );

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const tile = store.getTile(col, row);

      // Erase merges never create tiles, so a missing tile stays untouched.
      if (!tile && capture.operation !== "paint") {
        continue;
      }

      const tileX = col * store.tileSize - store.gutter;
      const tileY = row * store.tileSize - store.gutter;
      const width = store.tileSize + store.gutter * 2;
      const height = store.tileSize + store.gutter * 2;
      const rect = {
        maxX: Math.min(width, Math.ceil(mergedStoreRect.maxX - tileX)),
        maxY: Math.min(height, Math.ceil(mergedStoreRect.maxY - tileY)),
        minX: Math.max(0, Math.floor(mergedStoreRect.minX - tileX)),
        minY: Math.max(0, Math.floor(mergedStoreRect.minY - tileY)),
      };

      if (rect.maxX <= rect.minX || rect.maxY <= rect.minY) {
        continue;
      }

      if (!tile) {
        capture.tiles.push({ beforePixels: null, col, rect, row });
        continue;
      }

      const beforePixels = copyTileRect(tile, rect);

      capture.bytes += beforePixels.byteLength;
      capture.tiles.push({ beforePixels, col, rect, row });
    }
  }
};

const getStrokeStoreBytes = (strokeStore: RasterTileStore) => {
  let bytes = 0;

  for (const tile of strokeStore.tiles.values()) {
    bytes += tile.pixels.byteLength;
  }

  return bytes;
};

const RASTER_NODE_FIELDS = [
  "baseHeight",
  "baseWidth",
  "baseX",
  "baseY",
  "height",
  "src",
  "width",
] as const;

const hasRasterRelevantDiff = (before, after) => {
  if (before.type !== after.type) {
    return true;
  }

  for (const field of RASTER_NODE_FIELDS) {
    if (before[field] !== after[field]) {
      return true;
    }
  }

  return (
    JSON.stringify(before.tileSources ?? null) !==
    JSON.stringify(after.tileSources ?? null)
  );
};

/**
 * Node ids whose store pixels could disagree with the restored node state:
 * image nodes added or removed by the step, and updated nodes whose
 * pixel-relevant fields (src, tile manifest, base frame, dimensions, type)
 * changed. Transform-only changes leave the store valid.
 */
export const getRasterAffectedNodeIds = (change) => {
  const nodeIds = new Set<string>();

  for (const node of change.added || []) {
    if (node.type === "image") {
      nodeIds.add(node.id);
    }
  }

  for (const node of change.removed || []) {
    if (node.type === "image") {
      nodeIds.add(node.id);
    }
  }

  for (const entry of change.updated || []) {
    if (
      (entry.before.type === "image" || entry.after.type === "image") &&
      hasRasterRelevantDiff(entry.before, entry.after)
    ) {
      nodeIds.add(entry.before.id);
    }
  }

  return nodeIds;
};

/**
 * Editor-owned sidecar of per-commit raster tile deltas (Krita memento
 * model). The document history restores node state (src-less manifests); this
 * manager restores the matching store pixels and anchors so undo/redo never
 * drops the tile store or re-hydrates from encoded assets while a delta is
 * retained.
 *
 * Steps are keyed by the unique `historyStepId` the HistoryManager stamps on
 * each pushed change. Ids are monotonic and never reused, so entries stranded
 * by branch divergence (undo, then a new commit clears the redo stack) can
 * never collide with a live step; they age out through the depth cap.
 */
export class RasterHistoryManager {
  bytesBudget: number;
  depth: number;
  order: number[] = [];
  steps = new Map<number, RasterHistoryStep>();
  totalBytes = 0;

  constructor({
    bytesBudget = RASTER_HISTORY_BYTES_BUDGET,
    depth = RASTER_HISTORY_DEPTH,
  }: { bytesBudget?: number; depth?: number } = {}) {
    this.bytesBudget = bytesBudget;
    this.depth = depth;
  }

  get(historyStepId: number | null | undefined) {
    if (historyStepId == null) {
      return null;
    }

    return this.steps.get(historyStepId) || null;
  }

  record({
    anchorAfter,
    capture,
    historyStepId,
    nodeId,
    strokeStore,
  }: {
    anchorAfter: AnchorPoint;
    capture: RasterStrokeCapture;
    historyStepId: number | null | undefined;
    nodeId: string;
    strokeStore: RasterTileStore;
  }) {
    if (historyStepId == null) {
      return;
    }

    strokeStore.releaseStrokeScratch();

    const bytes = capture.bytes + getStrokeStoreBytes(strokeStore);
    const step: RasterHistoryStep = {
      ...capture,
      anchorAfter,
      bytes,
      historyStepId,
      nodeId,
      strokeStore,
    };

    this.evict(historyStepId);
    this.steps.set(historyStepId, step);
    this.order.push(historyStepId);
    this.totalBytes += bytes;
    incrementPerfCounter("raster.history.bytes", bytes);
    incrementPerfCounter("raster.history.step");

    // Depth cap and bytes budget, oldest first. A single over-budget step
    // evicts itself too — its undo takes the release fallback.
    while (
      this.order.length > 0 &&
      (this.order.length > this.depth || this.totalBytes > this.bytesBudget)
    ) {
      this.evict(this.order[0]);
    }
  }

  evict(historyStepId: number) {
    const step = this.steps.get(historyStepId);

    if (!step) {
      return;
    }

    const index = this.order.indexOf(historyStepId);

    if (index >= 0) {
      this.order.splice(index, 1);
    }

    this.steps.delete(historyStepId);
    this.totalBytes -= step.bytes;
    incrementPerfCounter("raster.history.bytes", -step.bytes);
    incrementPerfCounter("raster.history.evict");
  }

  clear() {
    for (const historyStepId of [...this.order]) {
      this.evict(historyStepId);
    }
  }

  /**
   * True when every tile this step's delta targets can take its write. A
   * hollow target cannot (partial-rect writes need the rest of the tile's
   * decoded content), and a captured before-rect needs its tile resident —
   * an absent tile there means the store was rebuilt since the commit. Both
   * fall back to releasing the node's store entry and rehydrating from the
   * restored manifest. Zero-fill markers (`beforePixels: null`) allow absent
   * tiles: a paint capture records them for store tiles the merge might not
   * actually create.
   */
  canApplyToStore(step: RasterHistoryStep, store: RasterTileStore) {
    for (const delta of step.tiles) {
      if (store.isHollow(delta.col, delta.row)) {
        return false;
      }

      if (delta.beforePixels && !store.getTile(delta.col, delta.row)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Write each captured before sub-rect back into the store (creating tiles
   * the undo needs to hold restored pixels, zero-filling rects of tiles the
   * commit created), restore the pre-commit anchor, and invalidate exactly
   * like a merge: syncRect unions, tile revisions, pyramid dirt, store
   * revision and dirty bounds.
   */
  applyUndo(step: RasterHistoryStep, entry: RasterStoreEntry) {
    const store = entry.store;
    let restoredBounds: Bounds | null = null;

    for (const delta of step.tiles) {
      let tile = store.getTile(delta.col, delta.row);

      if (!tile) {
        if (!delta.beforePixels) {
          continue;
        }

        tile = store.getOrCreateTile(delta.col, delta.row);
      }

      writeTileRect(tile, delta.rect, delta.beforePixels);
      tile.floatPixels = null;
      tile.syncRect = unionBounds(tile.syncRect, delta.rect);
      tile.revision += 1;
      store.markTileDirtyForPyramid(tile);
      restoredBounds = unionBounds(restoredBounds, {
        maxX: tile.x + delta.rect.maxX,
        maxY: tile.y + delta.rect.maxY,
        minX: tile.x + delta.rect.minX,
        minY: tile.y + delta.rect.minY,
      });
    }

    store.revision += 1;

    if (restoredBounds) {
      store.dirtyBounds = unionBounds(store.dirtyBounds, restoredBounds);
    }

    entry.anchorX = step.anchorBefore.x;
    entry.anchorY = step.anchorBefore.y;
  }

  /**
   * Redo re-merges the retained stroke buffer with the original merge anchors
   * and mode. The merge is deterministic and undo restored its exact input
   * pixels, so the result is byte-identical to the original commit and the
   * captured before sub-rects stay valid for the next undo.
   */
  applyRedo(step: RasterHistoryStep, entry: RasterStoreEntry) {
    mergeStrokeStore({
      anchorX: step.mergeAnchorX,
      anchorY: step.mergeAnchorY,
      mode: step.operation === "erase" ? "erase" : "paint",
      store: entry.store,
      strokeStore: step.strokeStore,
    });
    entry.anchorX = step.anchorAfter.x;
    entry.anchorY = step.anchorAfter.y;
  }
}
