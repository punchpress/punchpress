import { afterEach, describe, expect, test } from "bun:test";
import { RasterAssetStore } from "../../../../packages/engine/src/raster/raster-asset-store";
import {
  captureTileDeltasBeforeMerge,
  createStrokeCapture,
  RasterHistoryManager,
} from "../../../../packages/engine/src/raster/raster-history";
import {
  enforceRasterMemoryBudget,
  setRasterHotTileBudgetBytes,
} from "../../../../packages/engine/src/raster/raster-memory";
import { encodePngRgba } from "../../../../packages/engine/src/raster/raster-png";
import { RasterStoreManager } from "../../../../packages/engine/src/raster/raster-store-manager";
import {
  mergeStrokeStoreTile,
  RASTER_STORE_TILE_GUTTER,
  RASTER_STORE_TILE_SIZE,
  type RasterStoreTile,
  RasterTileStore,
} from "../../../../packages/engine/src/raster/raster-tile-store";

const TILE_PIXEL_BYTES =
  (RASTER_STORE_TILE_SIZE + RASTER_STORE_TILE_GUTTER * 2) ** 2 * 4;

const fillTilePattern = (tile: RasterStoreTile, seed: number) => {
  for (let index = 0; index < tile.pixels.length; index += 4) {
    tile.pixels[index] = (index * seed) % 256;
    tile.pixels[index + 1] = (index * seed + 41) % 256;
    tile.pixels[index + 2] = (index + seed) % 256;
    tile.pixels[index + 3] =
      index % 16 === 0 ? 0 : ((index * 3 + seed) % 128) + 128;
  }
};

/**
 * Commit-shaped test fixture: a pure-tiled node whose manifest payloads are
 * this engine's own PNG encoding of each tile's full physical rect. This is
 * what a store-backed commit leaves behind, and what rehydration decodes.
 */
const createCommittedFixture = async (
  tileCoords: Array<{ col: number; row: number }>,
  { nodeId = "raster-node" } = {}
) => {
  const assets = new RasterAssetStore();
  const node: {
    id: string;
    tileSources: Record<string, number | string>[];
    type: string;
    height: number;
    width: number;
  } = {
    height: RASTER_STORE_TILE_SIZE * 4,
    id: nodeId,
    tileSources: [],
    type: "image",
    width: RASTER_STORE_TILE_SIZE * 4,
  };
  const manager = new RasterStoreManager({
    assets,
    getNode: () => node as never,
  });
  const entry = manager.getOrCreateEntry(nodeId);

  for (const [index, coords] of tileCoords.entries()) {
    const tile = entry.store.getOrCreateTile(coords.col, coords.row);

    fillTilePattern(tile, index * 5 + 3);

    const ref = `assets/raster/${nodeId}/tiles/1_${coords.col}_${coords.row}.png`;

    assets.put(
      ref,
      await encodePngRgba(tile.pixels, tile.width, tile.height),
      "image/png"
    );
    node.tileSources.push({
      col: coords.col,
      height: tile.height,
      ref,
      row: coords.row,
      width: tile.width,
      x: tile.x,
      y: tile.y,
    });
  }

  return { assets, entry, manager, node };
};

afterEach(() => {
  setRasterHotTileBudgetBytes(null);
});

describe("hot-tile eviction and rehydration", () => {
  test("evicting a tile and rehydrating from its manifest payload is byte-identical", async () => {
    const { entry, manager, node } = await createCommittedFixture([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
    ]);
    const tile = entry.store.getTile(0, 0);

    if (!tile) {
      throw new Error("Expected resident tile");
    }

    const snapshot = tile.pixels.slice();

    expect(entry.store.evictTile(0, 0)).toBe(true);
    expect(entry.store.getTile(0, 0)).toBeNull();
    expect(entry.store.isHollow(0, 0)).toBe(true);

    await manager.ensureTilesHydrated(node as never, {
      maxX: RASTER_STORE_TILE_SIZE,
      maxY: RASTER_STORE_TILE_SIZE,
      minX: 0,
      minY: 0,
    });

    const rehydrated = entry.store.getTile(0, 0);

    expect(rehydrated).not.toBeNull();
    expect(entry.store.isHollow(0, 0)).toBe(false);
    expect(rehydrated?.pixels).toEqual(snapshot);
    // The untouched neighbor stayed resident throughout.
    expect(entry.store.getTile(1, 0)).not.toBeNull();
  });

  test("painting past the budget keeps decoded bytes at most budget plus one tile", async () => {
    const { entry } = await createCommittedFixture([]);
    const budget = TILE_PIXEL_BYTES * 3;

    setRasterHotTileBudgetBytes(budget);

    for (let index = 0; index < 8; index += 1) {
      const tile = entry.store.getOrCreateTile(index, 0);

      fillTilePattern(tile, index + 1);
      // Between enforcement passes at most one new tile can exceed the
      // budget; each pass trims back under it.
      expect(entry.store.decodedBytes).toBeLessThanOrEqual(
        budget + TILE_PIXEL_BYTES
      );
      enforceRasterMemoryBudget();
    }

    expect(entry.store.decodedBytes).toBeLessThanOrEqual(budget);
    expect(entry.store.tileCount + entry.store.hollowTileCount).toBe(8);
  });

  test("eviction drops the least recently used tiles first", async () => {
    const { entry } = await createCommittedFixture([]);

    for (let index = 0; index < 4; index += 1) {
      entry.store.getOrCreateTile(index, 0);
    }

    // Touch tile 0 so tile 1 becomes the oldest.
    entry.store.getTile(0, 0);
    setRasterHotTileBudgetBytes(TILE_PIXEL_BYTES * 3);
    enforceRasterMemoryBudget();

    expect(entry.store.isHollow(1, 0)).toBe(true);
    expect(entry.store.getTile(0, 0)).not.toBeNull();
    expect(entry.store.getTile(3, 0)).not.toBeNull();
  });

  test("never evicts tiles of a node with an unmerged stroke buffer", () => {
    const assets = new RasterAssetStore();
    const manager = new RasterStoreManager({
      assets,
      isNodePinned: () => true,
    });
    const entry = manager.getOrCreateEntry("pinned-node");

    for (let index = 0; index < 4; index += 1) {
      entry.store.getOrCreateTile(index, 0);
    }

    setRasterHotTileBudgetBytes(TILE_PIXEL_BYTES);
    enforceRasterMemoryBudget();

    expect(entry.store.tileCount).toBe(4);
    expect(entry.store.hollowTileCount).toBe(0);
  });

  test("never evicts tiles while a commit's merge or encode is pending", async () => {
    const { entry } = await createCommittedFixture([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 2, row: 0 },
    ]);

    entry.pendingCommits = 1;
    setRasterHotTileBudgetBytes(TILE_PIXEL_BYTES);
    enforceRasterMemoryBudget();

    expect(entry.store.tileCount).toBe(3);

    entry.pendingCommits = 0;
    enforceRasterMemoryBudget();

    expect(entry.store.decodedBytes).toBeLessThanOrEqual(TILE_PIXEL_BYTES);
  });

  test("released stores leave the budget registry", async () => {
    const { entry, manager } = await createCommittedFixture([
      { col: 0, row: 0 },
    ]);

    expect(entry.store.decodedBytes).toBeGreaterThan(0);
    manager.releaseAll();
    setRasterHotTileBudgetBytes(1);
    // Enforcement must not touch (or count) the released store.
    enforceRasterMemoryBudget();
    expect(entry.store.tileCount).toBe(1);
  });
});

describe("undo capture after hydration", () => {
  test("before-rects capture hydrated payload content, not cold zeros", async () => {
    const { entry, manager, node } = await createCommittedFixture([
      { col: 0, row: 0 },
    ]);
    const committedTile = entry.store.getTile(0, 0);

    if (!committedTile) {
      throw new Error("Expected committed tile");
    }

    const hydratedSnapshot = committedTile.pixels.slice();

    // Cold start: the tile's decoded pixels are gone (evicted or reloaded).
    entry.store.evictTile(0, 0);

    // A stroke that overlaps the cold tile.
    const strokeStore = new RasterTileStore();
    const strokeTile = strokeStore.getOrCreateTile(0, 0);

    for (let y = 40; y < 80; y += 1) {
      for (let x = 40; x < 80; x += 1) {
        const offset = (y * strokeTile.width + x) * 4;

        strokeTile.pixels[offset] = 200;
        strokeTile.pixels[offset + 3] = 255;
      }
    }

    // The commit merge's order of operations: hydrate the touched tiles,
    // THEN capture before-rects, THEN merge.
    await manager.ensureTilesHydrated(node as never, {
      maxX: strokeTile.nominalX + strokeTile.nominalWidth,
      maxY: strokeTile.nominalY + strokeTile.nominalHeight,
      minX: strokeTile.nominalX,
      minY: strokeTile.nominalY,
    });

    const capture = createStrokeCapture({
      anchorBefore: { x: 0, y: 0 },
      mergeAnchorX: 0,
      mergeAnchorY: 0,
      operation: "paint",
    });

    captureTileDeltasBeforeMerge({
      anchorX: 0,
      anchorY: 0,
      capture,
      store: entry.store,
      strokeTile,
    });
    mergeStrokeStoreTile({
      mode: "paint",
      store: entry.store,
      strokeTile,
    });

    const delta = capture.tiles.find(
      (candidate) => candidate.col === 0 && candidate.row === 0
    );

    if (!delta?.beforePixels) {
      throw new Error("Expected a captured before-rect for the target tile");
    }

    // The captured rect must hold the HYDRATED committed content: compare
    // against the pre-eviction snapshot over the same rect.
    const rectWidth = delta.rect.maxX - delta.rect.minX;
    let mismatches = 0;
    let nonZeroBytes = 0;

    for (let y = delta.rect.minY; y < delta.rect.maxY; y += 1) {
      for (let x = delta.rect.minX; x < delta.rect.maxX; x += 1) {
        const capturedOffset =
          ((y - delta.rect.minY) * rectWidth + (x - delta.rect.minX)) * 4;
        const snapshotOffset = (y * committedTile.width + x) * 4;

        for (let channel = 0; channel < 4; channel += 1) {
          if (
            delta.beforePixels[capturedOffset + channel] !==
            hydratedSnapshot[snapshotOffset + channel]
          ) {
            mismatches += 1;
          }

          if (delta.beforePixels[capturedOffset + channel] !== 0) {
            nonZeroBytes += 1;
          }
        }
      }
    }

    expect(mismatches).toBe(0);
    expect(nonZeroBytes).toBeGreaterThan(0);
  });
});

describe("raster history bytes budget", () => {
  test("retained steps evict oldest-first past the bytes budget", () => {
    const stepBytes = TILE_PIXEL_BYTES;
    const history = new RasterHistoryManager({
      bytesBudget: Math.floor(stepBytes * 2.5),
    });
    const recordStep = (historyStepId: number) => {
      const strokeStore = new RasterTileStore();
      const strokeTile = strokeStore.getOrCreateTile(0, 0);

      strokeTile.pixels[3] = 255;
      history.record({
        anchorAfter: { x: 0, y: 0 },
        capture: createStrokeCapture({
          anchorBefore: { x: 0, y: 0 },
          mergeAnchorX: 0,
          mergeAnchorY: 0,
          operation: "paint",
        }),
        historyStepId,
        nodeId: "node-1",
        strokeStore,
      });
    };

    recordStep(1);
    recordStep(2);

    expect(history.get(1)).not.toBeNull();
    expect(history.get(2)).not.toBeNull();
    expect(history.totalBytes).toBeLessThanOrEqual(stepBytes * 2.5);

    recordStep(3);

    // Three steps exceed the budget: the oldest goes, the newest stays.
    expect(history.get(1)).toBeNull();
    expect(history.get(2)).not.toBeNull();
    expect(history.get(3)).not.toBeNull();
    expect(history.totalBytes).toBeLessThanOrEqual(stepBytes * 2.5);
  });

  test("a single over-budget step evicts itself and undo falls back", () => {
    const history = new RasterHistoryManager({ bytesBudget: 16 });
    const strokeStore = new RasterTileStore();

    strokeStore.getOrCreateTile(0, 0);
    history.record({
      anchorAfter: { x: 0, y: 0 },
      capture: createStrokeCapture({
        anchorBefore: { x: 0, y: 0 },
        mergeAnchorX: 0,
        mergeAnchorY: 0,
        operation: "paint",
      }),
      historyStepId: 9,
      nodeId: "node-1",
      strokeStore,
    });

    expect(history.get(9)).toBeNull();
    expect(history.totalBytes).toBe(0);
  });
});

describe("hollow tiles and history deltas", () => {
  test("a step whose delta targets a hollow tile reports not-applyable", async () => {
    const { entry } = await createCommittedFixture([{ col: 0, row: 0 }]);
    const history = new RasterHistoryManager();
    const strokeStore = new RasterTileStore();
    const strokeTile = strokeStore.getOrCreateTile(0, 0);

    strokeTile.pixels[3] = 255;

    const capture = createStrokeCapture({
      anchorBefore: { x: 0, y: 0 },
      mergeAnchorX: 0,
      mergeAnchorY: 0,
      operation: "paint",
    });

    captureTileDeltasBeforeMerge({
      anchorX: 0,
      anchorY: 0,
      capture,
      store: entry.store,
      strokeTile,
    });
    history.record({
      anchorAfter: { x: 0, y: 0 },
      capture,
      historyStepId: 1,
      nodeId: "raster-node",
      strokeStore,
    });

    const step = history.get(1);

    if (!step) {
      throw new Error("Expected retained step");
    }

    expect(history.canApplyToStore(step, entry.store)).toBe(true);

    entry.store.evictTile(0, 0);

    expect(history.canApplyToStore(step, entry.store)).toBe(false);
  });
});
