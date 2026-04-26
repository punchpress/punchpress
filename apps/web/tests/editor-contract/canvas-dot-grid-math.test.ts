import { expect, test } from "bun:test";
import {
  getCanvasDotGridPatternOffset,
  getCanvasDotGridStepIndex,
  getCanvasDotGridStepOpacity,
} from "../../src/components/canvas/canvas-dot-grid-math";

test("canvas dot grid aligns to a stable world origin", () => {
  const spacing = 64;
  const originOffset = getCanvasDotGridPatternOffset(0, spacing);
  const shiftedOriginOffset = getCanvasDotGridPatternOffset(-12, spacing);

  expect(originOffset).toBeCloseTo(0.5, 5);
  expect(shiftedOriginOffset).toBeCloseTo(12.5, 5);
});

test("canvas dot grid chooses one active step and one easing-in step", () => {
  const zoom = 1;
  const finestEligibleIndex = getCanvasDotGridStepIndex(zoom);

  expect(finestEligibleIndex).toBe(5);
  expect(getCanvasDotGridStepOpacity(zoom, finestEligibleIndex)).toBe(0);
  expect(
    getCanvasDotGridStepOpacity(zoom, finestEligibleIndex - 1)
  ).toBeGreaterThan(0);
  expect(
    getCanvasDotGridStepOpacity(zoom, finestEligibleIndex - 1)
  ).toBeLessThan(0.5);
  expect(getCanvasDotGridStepOpacity(zoom, finestEligibleIndex - 2)).toBe(1);
  expect(getCanvasDotGridStepOpacity(zoom, finestEligibleIndex + 1)).toBe(0);
});

test("canvas dot grid switches to much coarser steps at low zoom", () => {
  expect(getCanvasDotGridStepIndex(0.16)).toBe(1);
  expect(getCanvasDotGridStepIndex(0.28)).toBe(2);
  expect(getCanvasDotGridStepIndex(0.45)).toBe(3);
});

test("canvas dot grid fades finer levels in gradually instead of dropping coarse levels", () => {
  expect(getCanvasDotGridStepOpacity(0.7, 2)).toBe(1);
  expect(getCanvasDotGridStepOpacity(0.7, 3)).toBeGreaterThan(0);
  expect(getCanvasDotGridStepOpacity(0.7, 3)).toBeLessThan(1);
});
