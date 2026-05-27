import { describe, expect, test } from "bun:test";
import {
  GESTURE_TOLERANCES_PX,
  getGestureTolerancePx,
  getGestureToleranceSquared,
  getPointerDistancePx,
  getPointerDistanceSquared,
  hasPointerMovedAtLeast,
  hasPointerMovedWithin,
  isPointerDistanceAtLeast,
  isPointerDistanceWithin,
} from "@punchpress/engine";

describe("gesture tolerance policy", () => {
  test("uses squared-distance math for drag threshold checks", () => {
    const origin = { x: 10, y: 20 };
    const belowDiagonal = { x: 12, y: 22 };
    const exactDiagonal = { x: 13, y: 20 };
    const aboveDiagonal = { x: 13, y: 23 };

    expect(getPointerDistanceSquared(origin, belowDiagonal)).toBe(8);
    expect(getPointerDistancePx(origin, belowDiagonal)).toBeCloseTo(
      Math.sqrt(8)
    );
    expect(isPointerDistanceAtLeast(origin, belowDiagonal, 3)).toBe(false);
    expect(isPointerDistanceAtLeast(origin, exactDiagonal, 3)).toBe(true);
    expect(isPointerDistanceAtLeast(origin, aboveDiagonal, 3)).toBe(true);
    expect(isPointerDistanceWithin(origin, belowDiagonal, 3)).toBe(true);
    expect(isPointerDistanceWithin(origin, aboveDiagonal, 3)).toBe(false);
  });

  test("exposes named gesture tolerances through one policy surface", () => {
    expect(getGestureTolerancePx("selectionDrag")).toBe(3);
    expect(getGestureToleranceSquared("selectionDrag")).toBe(9);
    expect(getGestureTolerancePx("penDrag")).toBe(3);
    expect(getGestureTolerancePx("vectorPathPointDrag")).toBe(4);
    expect(getGestureTolerancePx("vectorPathHit")).toBe(10);
    expect(GESTURE_TOLERANCES_PX.vectorSegmentInsertHit).toBe(10);
  });

  test("checks named gesture movement without callers owning raw thresholds", () => {
    const origin = { x: 0, y: 0 };

    expect(
      hasPointerMovedAtLeast(origin, { x: 2, y: 2 }, "selectionDrag")
    ).toBe(false);
    expect(
      hasPointerMovedAtLeast(origin, { x: 3, y: 0 }, "selectionDrag")
    ).toBe(true);
    expect(
      hasPointerMovedAtLeast(origin, { x: 3, y: 3 }, "vectorPathPointDrag")
    ).toBe(true);
    expect(
      hasPointerMovedWithin(origin, { x: 0.4, y: 0.2 }, "pointEpsilon")
    ).toBe(true);
  });
});
