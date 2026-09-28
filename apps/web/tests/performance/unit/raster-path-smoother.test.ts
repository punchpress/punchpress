import { describe, expect, test } from "bun:test";
import { createRasterPathSmoother } from "../../../../../packages/engine/src/raster/path-smoother";

describe("Raster native path smoothing", () => {
  test("bounds geometry emitted for an extreme input segment", () => {
    const smoother = createRasterPathSmoother({
      size: 24,
      smoothing: 0.1,
    });

    expect(smoother.append([{ x: 0, y: 0 }])).toEqual([{ x: 0, y: 0 }]);

    const points = smoother.append([{ x: 40_000, y: 7800 }]);

    expect(points.length).toBeGreaterThan(1);
    expect(points.length).toBeLessThanOrEqual(64);
    expect(
      points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))
    ).toBe(true);
  });

  test("translates pending smoothing state into a rebased canvas plane", () => {
    const smoother = createRasterPathSmoother({
      size: 40,
      smoothing: 0.1,
    });

    smoother.append([
      { x: 70, y: 70 },
      { x: 20, y: 20 },
    ]);
    smoother.translate({ x: 100, y: 80 });

    const points = smoother.append([{ x: 180, y: 160 }]);
    const tail = smoother.finish();

    expect(points.every((point) => point.x >= 0 && point.y >= 0)).toBe(true);
    expect(tail).toEqual([{ x: 180, y: 160 }]);
  });
});
