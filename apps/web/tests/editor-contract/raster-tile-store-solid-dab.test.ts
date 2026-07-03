import { describe, expect, test } from "bun:test";
import { RasterTileStore } from "../../../../packages/engine/src/raster/raster-tile-store";

// Mirrors getBrushDabCoverage for hardness >= 1: a one-pixel antialias band
// around an otherwise solid circle.
const hardBrushCoverage =
  (radius: number) =>
  (x: number, y: number, point: { x: number; y: number }) => {
    const distance = Math.hypot(x - point.x, y - point.y);

    return Math.min(1, Math.max(0, radius + 0.5 - distance));
  };

const paintDabAt = (
  store: RasterTileStore,
  point: { x: number; y: number },
  radius: number,
  {
    color = { b: 30, g: 40, r: 200 },
    skip = undefined as { x: number; y: number } | undefined,
    solid = false,
  } = {}
) => {
  const renderRadius = radius + 0.5;

  store.paintDab({
    bounds: {
      maxX: Math.ceil(point.x + renderRadius),
      maxY: Math.ceil(point.y + renderRadius),
      minX: Math.floor(point.x - renderRadius),
      minY: Math.floor(point.y - renderRadius),
    },
    color,
    getCoverage: hardBrushCoverage(radius),
    opacity: 1,
    point,
    solid: solid
      ? { radius, skip: skip ? { radius, ...skip } : undefined }
      : undefined,
  });
};

const getMaxStoreChannelDiff = (a: RasterTileStore, b: RasterTileStore) => {
  const keys = new Set([...a.tiles.keys(), ...b.tiles.keys()]);
  let maxDiff = 0;

  for (const key of keys) {
    const pixelsA = a.tiles.get(key)?.pixels;
    const pixelsB = b.tiles.get(key)?.pixels;

    if (!(pixelsA && pixelsB)) {
      // A tile materialized on one side only counts as a full mismatch.
      maxDiff = Math.max(maxDiff, 255);
      continue;
    }

    for (let offset = 0; offset < pixelsA.length; offset += 1) {
      maxDiff = Math.max(maxDiff, Math.abs(pixelsA[offset] - pixelsB[offset]));
    }
  }

  return maxDiff;
};

const countPartialAlphaPixels = (store: RasterTileStore) => {
  let count = 0;

  for (const tile of store.tiles.values()) {
    for (let offset = 3; offset < tile.pixels.length; offset += 4) {
      const alpha = tile.pixels[offset];

      if (alpha > 0 && alpha < 255) {
        count += 1;
      }
    }
  }

  return count;
};

describe("raster tile store solid dab fast path", () => {
  test("solid dab matches the coverage path within one channel step", () => {
    const reference = new RasterTileStore();
    const fast = new RasterTileStore();
    // Straddles the tile seam at 512 so gutter writes are compared too.
    const point = { x: 512, y: 40 };

    paintDabAt(reference, point, 20);
    paintDabAt(fast, point, 20, { solid: true });

    expect(getMaxStoreChannelDiff(reference, fast)).toBeLessThanOrEqual(1);
    expect(fast.getPixelAt(512, 40)).toEqual([200, 40, 30, 255]);
  });

  test("solid dab keeps an antialiased edge band", () => {
    const fast = new RasterTileStore();
    const reference = new RasterTileStore();

    paintDabAt(fast, { x: 100, y: 100 }, 20, { solid: true });
    paintDabAt(reference, { x: 100, y: 100 }, 20);

    const partialCount = countPartialAlphaPixels(fast);

    expect(partialCount).toBeGreaterThan(20);

    const referenceCount = countPartialAlphaPixels(reference);

    expect(Math.abs(partialCount - referenceCount)).toBeLessThanOrEqual(8);
  });

  test("overlapping solid dabs along a stroke paint the union envelope", () => {
    // Solid dabs compose by coverage MAX: the stroke is the union of its
    // dabs, so every pixel holds the envelope coverage of its nearest dab
    // center -- not a source-over accumulation of overlapping edge bands.
    const fast = new RasterTileStore();
    const radius = 24;
    const points: { x: number; y: number }[] = [];

    for (let step = 0; step <= 10; step += 1) {
      const point = { x: 60 + step * 12, y: 80 + step * 3 };

      points.push(point);
      paintDabAt(fast, point, radius, { solid: true });
    }

    let mismatch: Record<string, number> | null = null;

    for (const tile of fast.tiles.values()) {
      for (let localY = 0; !mismatch && localY < tile.height; localY += 1) {
        for (let localX = 0; localX < tile.width; localX += 1) {
          const sampleX = tile.x + localX + 0.5;
          const sampleY = tile.y + localY + 0.5;
          let distance = Number.POSITIVE_INFINITY;

          for (const point of points) {
            distance = Math.min(
              distance,
              Math.hypot(sampleX - point.x, sampleY - point.y)
            );
          }

          const expected = Math.round(
            Math.min(1, Math.max(0, radius + 0.5 - distance)) * 255
          );
          const actual = tile.pixels[(localY * tile.width + localX) * 4 + 3];

          if (Math.abs(actual - expected) > 1) {
            mismatch = {
              actual,
              expected,
              worldX: tile.x + localX,
              worldY: tile.y + localY,
            };
            break;
          }
        }
      }
    }

    expect(mismatch).toBeNull();
  });

  test("skip-circle dabs leave no gaps and match unskipped solid dabs", () => {
    const unskipped = new RasterTileStore();
    const skipped = new RasterTileStore();
    let previousPoint: { x: number; y: number } | undefined;

    for (let step = 0; step <= 12; step += 1) {
      // Cross the tile seam at 512 mid-stroke with tight dab spacing.
      const point = { x: 440 + step * 14, y: 100 + step * 2 };

      paintDabAt(unskipped, point, 30, { solid: true });
      paintDabAt(skipped, point, 30, { skip: previousPoint, solid: true });
      previousPoint = point;
    }

    expect(getMaxStoreChannelDiff(unskipped, skipped)).toBe(0);
  });

  test("skip circle fully covering the dab interior writes only edges", () => {
    const reference = new RasterTileStore();
    const fast = new RasterTileStore();
    const point = { x: 200, y: 200 };

    paintDabAt(reference, point, 20, { solid: true });
    paintDabAt(reference, point, 20, { solid: true });
    paintDabAt(fast, point, 20, { solid: true });
    paintDabAt(fast, point, 20, { skip: point, solid: true });

    expect(getMaxStoreChannelDiff(reference, fast)).toBe(0);
    expect(fast.getPixelAt(200, 200)).toEqual([200, 40, 30, 255]);
  });

  test("solid dabs on negative-coordinate tiles match the coverage path", () => {
    const reference = new RasterTileStore();
    const fast = new RasterTileStore();
    const point = { x: -700, y: -10 };

    paintDabAt(reference, point, 18);
    paintDabAt(fast, point, 18, { solid: true });

    expect(getMaxStoreChannelDiff(reference, fast)).toBeLessThanOrEqual(1);
    expect(fast.getTile(-2, -1)).not.toBeNull();
    expect(fast.getPixelAt(-700, -10)[3]).toBe(255);
  });

  test("solid dabs avoid allocating float scratch and stay soft-dab safe", () => {
    const fast = new RasterTileStore();

    paintDabAt(fast, { x: 100, y: 100 }, 20, { solid: true });

    expect(fast.getTile(0, 0).floatPixels).toBeNull();

    // A later soft dab re-seeds float scratch from bytes and blends correctly.
    fast.paintDab({
      bounds: { maxX: 110, maxY: 110, minX: 90, minY: 90 },
      color: { b: 220, g: 10, r: 10 },
      getCoverage: () => 1,
      opacity: 0.5,
      point: { x: 100, y: 100 },
    });

    const blended = fast.getPixelAt(100, 100);

    expect(blended[3]).toBe(255);
    expect(blended[0]).toBeLessThan(200);
    expect(blended[2]).toBeGreaterThan(30);
  });

  test("erase ignores the solid flag and reduces alpha by coverage", () => {
    const reference = new RasterTileStore();
    const fast = new RasterTileStore();

    for (const store of [reference, fast]) {
      paintDabAt(store, { x: 100, y: 100 }, 20, { solid: true });
    }

    reference.eraseDab({
      bounds: { maxX: 110, maxY: 110, minX: 90, minY: 90 },
      getCoverage: hardBrushCoverage(8),
      opacity: 0.5,
      point: { x: 100, y: 100 },
    });
    fast.eraseDab({
      bounds: { maxX: 110, maxY: 110, minX: 90, minY: 90 },
      getCoverage: hardBrushCoverage(8),
      opacity: 0.5,
      point: { x: 100, y: 100 },
      solid: { radius: 8 },
    });

    expect(getMaxStoreChannelDiff(reference, fast)).toBe(0);
    expect(fast.getPixelAt(100, 100)[3]).toBe(128);
  });
});
