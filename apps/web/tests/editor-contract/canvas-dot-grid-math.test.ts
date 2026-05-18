import { expect, test } from "bun:test";
import {
  DOT_GRID_STEPS,
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

  expect(DOT_GRID_STEPS[finestEligibleIndex].step).toBe(14);
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
  expect(DOT_GRID_STEPS[getCanvasDotGridStepIndex(0.01)].step).toBe(3584);
  expect(DOT_GRID_STEPS[getCanvasDotGridStepIndex(0.02)].step).toBe(1792);
  expect(DOT_GRID_STEPS[getCanvasDotGridStepIndex(0.05)].step).toBe(448);
  expect(DOT_GRID_STEPS[getCanvasDotGridStepIndex(0.16)].step).toBe(224);
  expect(DOT_GRID_STEPS[getCanvasDotGridStepIndex(0.28)].step).toBe(112);
  expect(DOT_GRID_STEPS[getCanvasDotGridStepIndex(0.45)].step).toBe(56);
});

test("canvas dot grid keeps readable screen spacing at one percent zoom", () => {
  const zoom = 0.01;
  const activeStep = DOT_GRID_STEPS[getCanvasDotGridStepIndex(zoom)];

  expect(activeStep.step * zoom).toBeGreaterThanOrEqual(28);
});

test("canvas dot grid fades finer levels in gradually instead of dropping coarse levels", () => {
  const activeStepIndex = getCanvasDotGridStepIndex(0.7);

  expect(getCanvasDotGridStepOpacity(0.7, activeStepIndex - 2)).toBe(1);
  expect(getCanvasDotGridStepOpacity(0.7, activeStepIndex - 1)).toBeGreaterThan(
    0
  );
  expect(getCanvasDotGridStepOpacity(0.7, activeStepIndex - 1)).toBeLessThan(1);
  expect(getCanvasDotGridStepOpacity(0.7, activeStepIndex)).toBe(0);
});
