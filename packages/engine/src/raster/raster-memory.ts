import { incrementPerfCounter, measurePerf } from "../perf/perf-hooks";
import {
  canScheduleRasterFrame,
  getNow,
  requestRasterFrame,
} from "../tools/brush-runtime";
import type { RasterStoreTile, RasterTileStore } from "./raster-tile-store";

/**
 * Global hot-tile budget: decoded level-0 tile pixels across every
 * registered committed store (stroke buffers and history captures are
 * accounted separately by the history bytes budget). Over budget, the
 * least-recently-used tiles are evicted to hollow — their self-complete
 * manifest payloads are the recovery source.
 */
export const RASTER_HOT_TILE_BUDGET_BYTES = 384 * 1024 * 1024;

let hotTileBudgetBytes = RASTER_HOT_TILE_BUDGET_BYTES;

/** Test seam: shrink the budget to force eviction with small fixtures. */
export const setRasterHotTileBudgetBytes = (bytes: number | null) => {
  hotTileBudgetBytes = bytes ?? RASTER_HOT_TILE_BUDGET_BYTES;
};

export const getRasterHotTileBudgetBytes = () => hotTileBudgetBytes;

export type EvictableStoreHandle = {
  /**
   * Never-evict guard: true while the store's node has an unmerged stroke
   * buffer or a commit (merge or encode) queued or running.
   */
  isPinned: () => boolean;
  /**
   * Called with each tile immediately before eviction so the owner can
   * secure zoomed-out coverage (build the tile's level-1 pyramid ancestor
   * while the pixels are still resident).
   */
  prepareEviction: (tile: RasterStoreTile) => void;
  store: RasterTileStore;
};

const evictableStores = new Set<EvictableStoreHandle>();

export const registerEvictableStore = (handle: EvictableStoreHandle) => {
  evictableStores.add(handle);
};

export const unregisterEvictableStore = (handle: EvictableStoreHandle) => {
  if (evictableStores.delete(handle) && handle.store.decodedBytes > 0) {
    // The store's tiles drop with it; keep the perf counter honest.
    incrementPerfCounter("raster.hotTiles.bytes", -handle.store.decodedBytes);
  }
};

export const getRasterHotTileBytes = () => {
  let bytes = 0;

  for (const handle of evictableStores) {
    bytes += handle.store.decodedBytes;
  }

  return bytes;
};

/**
 * Evict least-recently-used tiles across all unpinned registered stores
 * until decoded bytes fit the budget or the optional time budget runs out.
 * Returns true when under budget. A pinned store can carry the total over
 * budget until its commit settles; the next enforcement pass trims it back.
 */
export const enforceRasterMemoryBudget = ({
  budgetMs = Number.POSITIVE_INFINITY,
}: { budgetMs?: number } = {}) =>
  measurePerf("raster.memory.enforce", () =>
    runBudgetEnforcement(budgetMs)
  );

const runBudgetEnforcement = (budgetMs: number) => {
  let totalBytes = getRasterHotTileBytes();

  if (totalBytes <= hotTileBudgetBytes) {
    return true;
  }

  const deadline = Number.isFinite(budgetMs)
    ? getNow() + budgetMs
    : Number.POSITIVE_INFINITY;
  const candidates: Array<{
    handle: EvictableStoreHandle;
    tile: RasterStoreTile;
  }> = [];

  for (const handle of evictableStores) {
    if (handle.isPinned()) {
      continue;
    }

    for (const tile of handle.store.tiles.values()) {
      candidates.push({ handle, tile });
    }
  }

  candidates.sort((first, second) => first.tile.lastUse - second.tile.lastUse);

  for (const candidate of candidates) {
    if (totalBytes <= hotTileBudgetBytes) {
      break;
    }

    if (getNow() >= deadline) {
      return false;
    }

    const { handle, tile } = candidate;

    handle.prepareEviction(tile);

    if (handle.store.evictTile(tile.col, tile.row)) {
      totalBytes -= tile.pixels.byteLength;
    }
  }

  return totalBytes <= hotTileBudgetBytes;
};

const ENFORCEMENT_CHUNK_BUDGET_MS = 6;
let enforcementScheduled = false;

/**
 * Run budget enforcement in rAF-cadenced chunks: eviction's per-tile cost is
 * the pyramid ancestor build (prepareEviction), so a large trim after a big
 * commit must not land as one long frame.
 */
export const scheduleRasterMemoryEnforcement = () => {
  if (!canScheduleRasterFrame()) {
    enforceRasterMemoryBudget();
    return;
  }

  if (enforcementScheduled) {
    return;
  }

  enforcementScheduled = true;
  requestRasterFrame(function runChunk() {
    const done = enforceRasterMemoryBudget({
      budgetMs: ENFORCEMENT_CHUNK_BUDGET_MS,
    });

    if (done) {
      enforcementScheduled = false;
      return;
    }

    requestRasterFrame(runChunk);
  });
};
