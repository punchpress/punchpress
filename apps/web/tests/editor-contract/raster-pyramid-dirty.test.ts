import { describe, expect, test } from "bun:test";
import {
  getRasterPyramidLevelForScale,
  RASTER_PYRAMID_MAX_LEVEL,
  RasterTilePyramid,
} from "../../../../packages/engine/src/raster/raster-pyramid";
import {
  mergeStrokeStore,
  RASTER_STORE_TILE_SIZE,
  RasterTileStore,
} from "../../../../packages/engine/src/raster/raster-tile-store";

const hardCircleCoverage = (radius: number) => {
  return (x: number, y: number, point: { x: number; y: number }) => {
    const dx = x - point.x;
    const dy = y - point.y;

    return dx * dx + dy * dy <= radius * radius ? 1 : 0;
  };
};

const paintHardDab = (
  store: RasterTileStore,
  point: { x: number; y: number },
  radius: number
) => {
  store.paintDab({
    bounds: {
      maxX: point.x + radius,
      maxY: point.y + radius,
      minX: point.x - radius,
      minY: point.y - radius,
    },
    color: { b: 30, g: 40, r: 200 },
    getCoverage: hardCircleCoverage(radius),
    opacity: 1,
    point,
  });
};

const tileCenter = (col: number, row: number) => ({
  x: (col + 0.5) * RASTER_STORE_TILE_SIZE,
  y: (row + 0.5) * RASTER_STORE_TILE_SIZE,
});

describe("raster pyramid dirty tracking", () => {
  test("writing a tile marks its ancestor coords at every level", () => {
    const store = new RasterTileStore();

    paintHardDab(store, tileCenter(3, 5), 8);

    expect(store.takeDirtyLevelCoords(1)).toEqual(new Set(["1:2"]));
    expect(store.takeDirtyLevelCoords(2)).toEqual(new Set(["0:1"]));
    expect(store.takeDirtyLevelCoords(3)).toEqual(new Set(["0:0"]));
    expect(store.takeDirtyLevelCoords(RASTER_PYRAMID_MAX_LEVEL)).toEqual(
      new Set(["0:0"])
    );
  });

  test("negative tile coords map to negative ancestor coords", () => {
    const store = new RasterTileStore();

    paintHardDab(store, tileCenter(-1, -1), 8);

    for (let level = 1; level <= RASTER_PYRAMID_MAX_LEVEL; level += 1) {
      expect(store.takeDirtyLevelCoords(level)).toEqual(new Set(["-1:-1"]));
    }
  });

  test("distant negative tiles floor toward negative infinity", () => {
    const store = new RasterTileStore();

    paintHardDab(store, tileCenter(-3, 0), 8);

    expect(store.takeDirtyLevelCoords(1)).toEqual(new Set(["-2:0"]));
    expect(store.takeDirtyLevelCoords(2)).toEqual(new Set(["-1:0"]));
    expect(store.takeDirtyLevelCoords(8)).toEqual(new Set(["-1:0"]));
  });

  test("sibling tiles dedupe into one ancestor coord per level", () => {
    const store = new RasterTileStore();

    paintHardDab(store, tileCenter(0, 0), 8);
    paintHardDab(store, tileCenter(1, 1), 8);

    expect(store.takeDirtyLevelCoords(1)).toEqual(new Set(["0:0"]));
  });

  test("taking dirty coords clears the level and reports null when clean", () => {
    const store = new RasterTileStore();

    expect(store.takeDirtyLevelCoords(1)).toBeNull();

    paintHardDab(store, tileCenter(0, 0), 8);

    expect(store.takeDirtyLevelCoords(1)).not.toBeNull();
    expect(store.takeDirtyLevelCoords(1)).toBeNull();
    expect(store.takeDirtyLevelCoords(2)).not.toBeNull();
  });

  test("stroke merge marks the committed store dirty, not just the stroke store", () => {
    const store = new RasterTileStore();
    const strokeStore = new RasterTileStore();

    paintHardDab(strokeStore, tileCenter(2, 0), 8);
    strokeStore.takeDirtyLevelCoords(1);

    expect(store.takeDirtyLevelCoords(1)).toBeNull();

    mergeStrokeStore({ mode: "paint", store, strokeStore });

    expect(store.takeDirtyLevelCoords(1)).toEqual(new Set(["1:0"]));
  });
});

describe("raster pyramid level selection", () => {
  test("scales above one half stay at level 0", () => {
    expect(getRasterPyramidLevelForScale(1)).toBe(0);
    expect(getRasterPyramidLevelForScale(2)).toBe(0);
    expect(getRasterPyramidLevelForScale(0.75)).toBe(0);
    expect(getRasterPyramidLevelForScale(0.51)).toBe(0);
  });

  test("halving boundaries land on the coarser level", () => {
    expect(getRasterPyramidLevelForScale(0.5)).toBe(1);
    expect(getRasterPyramidLevelForScale(0.26)).toBe(1);
    expect(getRasterPyramidLevelForScale(0.25)).toBe(2);
    expect(getRasterPyramidLevelForScale(0.125)).toBe(3);
    expect(getRasterPyramidLevelForScale(0.055)).toBe(4);
  });

  test("tiny and degenerate scales clamp to the max level", () => {
    expect(getRasterPyramidLevelForScale(0.001)).toBe(RASTER_PYRAMID_MAX_LEVEL);
    expect(getRasterPyramidLevelForScale(0)).toBe(RASTER_PYRAMID_MAX_LEVEL);
    expect(getRasterPyramidLevelForScale(-1)).toBe(RASTER_PYRAMID_MAX_LEVEL);
    expect(getRasterPyramidLevelForScale(Number.NaN)).toBe(
      RASTER_PYRAMID_MAX_LEVEL
    );
  });
});

describe("raster pyramid headless behavior", () => {
  test("getTile is null without a canvas runtime and never throws", () => {
    const store = new RasterTileStore();

    paintHardDab(store, tileCenter(0, 0), 8);

    const pyramid = new RasterTilePyramid(store);

    expect(pyramid.getTile(1, 0, 0)).toBeNull();
    expect(pyramid.getTile(4, 0, 0)).toBeNull();
    expect(pyramid.getTile(0, 0, 0)).toBeNull();
    expect(pyramid.getTile(RASTER_PYRAMID_MAX_LEVEL + 1, 0, 0)).toBeNull();
  });

  test("beginFrame drains the store's dirty level coords", () => {
    const store = new RasterTileStore();
    const pyramid = new RasterTilePyramid(store);

    paintHardDab(store, tileCenter(0, 0), 8);
    pyramid.beginFrame();

    for (let level = 1; level <= RASTER_PYRAMID_MAX_LEVEL; level += 1) {
      expect(store.takeDirtyLevelCoords(level)).toBeNull();
    }
  });
});
