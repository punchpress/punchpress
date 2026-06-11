import { describe, expect, test } from "bun:test";
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
  radius: number,
  { color = { b: 30, g: 40, r: 200 }, opacity = 1 } = {}
) => {
  store.paintDab({
    bounds: {
      maxX: point.x + radius,
      maxY: point.y + radius,
      minX: point.x - radius,
      minY: point.y - radius,
    },
    color,
    getCoverage: hardCircleCoverage(radius),
    opacity,
    point,
  });
};

describe("raster tile store paint", () => {
  test("materializes only touched tiles, including negative coordinates", () => {
    const store = new RasterTileStore();

    expect(store.tileCount).toBe(0);

    paintHardDab(store, { x: -700, y: -10 }, 20);

    expect(store.tileCount).toBeGreaterThan(0);
    expect(store.tileCount).toBeLessThanOrEqual(4);
    expect(store.getTile(-2, -1)).not.toBeNull();
    expect(store.getTile(0, 0)).toBeNull();
    expect(store.getTile(3, 3)).toBeNull();
  });

  test("paints dab pixels readable at world coordinates", () => {
    const store = new RasterTileStore();

    paintHardDab(store, { x: 100, y: 100 }, 16);

    expect(store.getPixelAt(100, 100)).toEqual([200, 40, 30, 255]);
    expect(store.getPixelAt(100, 130)[3]).toBe(0);
  });

  test("pixels straddling tile edges read identically on both sides", () => {
    const store = new RasterTileStore();
    const edge = RASTER_STORE_TILE_SIZE;

    paintHardDab(store, { x: edge, y: 40 }, 12);

    expect(store.getPixelAt(edge - 1, 40)[3]).toBe(255);
    expect(store.getPixelAt(edge, 40)[3]).toBe(255);
    expect(store.getTile(0, 0)).not.toBeNull();
    expect(store.getTile(1, 0)).not.toBeNull();
  });

  test("growing left never rebases existing tiles or moves painted pixels", () => {
    const store = new RasterTileStore();

    paintHardDab(store, { x: 10, y: 10 }, 8);

    const originTile = store.getTile(0, 0);
    const pixelBefore = store.getPixelAt(10, 10);

    paintHardDab(store, { x: -900, y: 10 }, 8, {
      color: { b: 220, g: 10, r: 10 },
    });

    expect(store.getTile(0, 0)).toBe(originTile);
    expect(store.getPixelAt(10, 10)).toEqual(pixelBefore);
    expect(store.getTile(-2, 0)).not.toBeNull();
    expect(store.getPixelAt(-900, 10)).toEqual([10, 10, 220, 255]);
  });

  test("erase reduces alpha and never materializes new tiles", () => {
    const store = new RasterTileStore();

    paintHardDab(store, { x: 50, y: 50 }, 10);

    const tileCountAfterPaint = store.tileCount;

    store.eraseDab({
      bounds: { maxX: 56, maxY: 56, minX: 44, minY: 44 },
      getCoverage: hardCircleCoverage(6),
      opacity: 0.5,
      point: { x: 50, y: 50 },
    });

    expect(store.getPixelAt(50, 50)[3]).toBe(128);

    store.eraseDab({
      bounds: { maxX: 2010, maxY: 2010, minX: 1990, minY: 1990 },
      getCoverage: hardCircleCoverage(10),
      opacity: 1,
      point: { x: 2000, y: 2000 },
    });

    expect(store.tileCount).toBe(tileCountAfterPaint);
  });

  test("repeated soft dabs accumulate alpha in float space without stalling", () => {
    const store = new RasterTileStore();
    let previousAlpha = 0;

    for (let index = 0; index < 50; index += 1) {
      paintHardDab(store, { x: 80, y: 80 }, 6, { opacity: 0.1 });

      const alpha = store.getPixelAt(80, 80)[3];

      expect(alpha).toBeGreaterThanOrEqual(previousAlpha);
      previousAlpha = alpha;
    }

    expect(previousAlpha).toBeGreaterThanOrEqual(250);
  });

  test("dirty bounds accumulate across dabs and reset on consume", () => {
    const store = new RasterTileStore();

    expect(store.consumeDirtyBounds()).toBeNull();

    paintHardDab(store, { x: 20, y: 20 }, 8);
    paintHardDab(store, { x: 600, y: 20 }, 8);

    const dirty = store.consumeDirtyBounds();

    expect(dirty).not.toBeNull();
    expect(dirty.minX).toBeLessThanOrEqual(12);
    expect(dirty.maxX).toBeGreaterThanOrEqual(608);
    expect(store.consumeDirtyBounds()).toBeNull();
  });

  test("painted bounds track lifetime extent and survive consume", () => {
    const store = new RasterTileStore();

    paintHardDab(store, { x: 0, y: 0 }, 8);
    store.consumeDirtyBounds();
    paintHardDab(store, { x: 300, y: 500 }, 8);

    const painted = store.getPaintedBounds();

    expect(painted.minX).toBeLessThanOrEqual(-8);
    expect(painted.maxX).toBeGreaterThanOrEqual(308);
    expect(painted.maxY).toBeGreaterThanOrEqual(508);
  });

  test("writes bump tile and store revisions for invalidation", () => {
    const store = new RasterTileStore();
    const revisionBefore = store.revision;

    paintHardDab(store, { x: 30, y: 30 }, 8);

    const tile = store.getTile(0, 0);
    const tileRevision = tile.revision;

    expect(store.revision).toBeGreaterThan(revisionBefore);

    paintHardDab(store, { x: 30, y: 30 }, 8);

    expect(store.getTile(0, 0).revision).toBeGreaterThan(tileRevision);
  });

  test("releasing stroke scratch buffers keeps painted pixels", () => {
    const store = new RasterTileStore();

    paintHardDab(store, { x: 40, y: 40 }, 8);
    store.releaseStrokeScratch();

    expect(store.getPixelAt(40, 40)).toEqual([200, 40, 30, 255]);
    expect(store.getTile(0, 0).floatPixels).toBeNull();
  });
});

describe("raster stroke store merge", () => {
  const paintAt = (store, point, radius, options = {}) => {
    store.paintDab({
      bounds: {
        maxX: point.x + radius,
        maxY: point.y + radius,
        minX: point.x - radius,
        minY: point.y - radius,
      },
      color: options.color || { b: 30, g: 40, r: 200 },
      getCoverage: (x, y, center) => {
        const dx = x - center.x;
        const dy = y - center.y;

        return dx * dx + dy * dy <= radius * radius ? 1 : 0;
      },
      opacity: options.opacity ?? 1,
      point,
    });
  };

  test("paint merge composites stroke pixels over committed pixels", () => {
    const store = new RasterTileStore();
    const strokeStore = new RasterTileStore();

    paintAt(store, { x: 100, y: 100 }, 20, { color: { b: 0, g: 0, r: 255 } });
    paintAt(strokeStore, { x: 100, y: 100 }, 8, {
      color: { b: 255, g: 0, r: 0 },
    });

    mergeStrokeStore({ mode: "paint", store, strokeStore });

    expect(store.getPixelAt(100, 100)).toEqual([0, 0, 255, 255]);
    expect(store.getPixelAt(100, 115)).toEqual([255, 0, 0, 255]);
  });

  test("erase merge reduces committed alpha and creates no tiles", () => {
    const store = new RasterTileStore();
    const strokeStore = new RasterTileStore();

    paintAt(store, { x: 100, y: 100 }, 20 );

    const tileCountBefore = store.tileCount;

    paintAt(strokeStore, { x: 100, y: 100 }, 6, { opacity: 0.5 });
    paintAt(strokeStore, { x: 900, y: 900 }, 6 );

    mergeStrokeStore({ mode: "erase", store, strokeStore });

    const erasedAlpha = store.getPixelAt(100, 100)[3];

    expect(erasedAlpha).toBeGreaterThanOrEqual(127);
    expect(erasedAlpha).toBeLessThanOrEqual(128);
    expect(store.getPixelAt(100, 115)[3]).toBe(255);
    expect(store.tileCount).toBe(tileCountBefore);
  });

  test("anchored merge lands stroke pixels at anchored store coordinates", () => {
    const store = new RasterTileStore();
    const strokeStore = new RasterTileStore();

    paintAt(strokeStore, { x: 50, y: 50 }, 4 );

    mergeStrokeStore({ anchorX: 600, anchorY: 0, mode: "paint", store, strokeStore });

    expect(store.getPixelAt(-550, 50)[3]).toBe(255);
    expect(store.getPixelAt(50, 50)[3]).toBe(0);
  });

  test("merge across a tile seam keeps both sides and gutters consistent", () => {
    const store = new RasterTileStore();
    const strokeStore = new RasterTileStore();
    const edge = RASTER_STORE_TILE_SIZE;

    paintAt(store, { x: edge, y: 40 }, 12 );
    paintAt(strokeStore, { x: edge, y: 40 }, 12, { opacity: 1 });

    mergeStrokeStore({ mode: "erase", store, strokeStore });

    expect(store.getPixelAt(edge - 1, 40)[3]).toBe(0);
    expect(store.getPixelAt(edge, 40)[3]).toBe(0);

    const leftTile = store.getTile(0, 0);
    const gutterOffset =
      ((40 - leftTile.y) * leftTile.width + (edge + 1 - leftTile.x)) * 4;

    expect(leftTile.pixels[gutterOffset + 3]).toBe(0);
  });
});
