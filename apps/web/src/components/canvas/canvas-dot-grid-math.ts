export const DOT_GRID_STEPS = [
  { mid: 0.18, min: -1, step: 448 },
  { mid: 0.3, min: 0.12, step: 224 },
  { mid: 0.5, min: 0.22, step: 112 },
  { mid: 0.85, min: 0.4, step: 56 },
  { mid: 1.6, min: 0.7, step: 28 },
  { mid: 3.2, min: 1, step: 14 },
];

export const clampCanvasDotGridValue = (
  value: number,
  min: number,
  max: number
) => {
  return Math.max(min, Math.min(max, value));
};

export const getCanvasDotGridPatternOffset = (
  worldOrigin: number,
  spacing: number
) => {
  const projectedOrigin = 0.5 - worldOrigin;
  const remainder = projectedOrigin % spacing;

  return remainder >= 0 ? remainder : spacing + remainder;
};

export const getCanvasDotGridStepIndex = (zoom: number) => {
  const index = DOT_GRID_STEPS.findLastIndex(({ min }) => zoom >= min);

  return index >= 0 ? index : 0;
};

export const getCanvasDotGridBucketProgress = (zoom: number, index: number) => {
  const step = DOT_GRID_STEPS[index];

  if (!(step && step.mid > step.min)) {
    return 1;
  }

  return clampCanvasDotGridValue(
    (zoom - step.min) / (step.mid - step.min),
    0,
    1
  );
};

export const getCanvasDotGridStepOpacity = (zoom: number, index: number) => {
  const step = DOT_GRID_STEPS[index];

  if (!step) {
    return 0;
  }

  if (zoom >= step.mid) {
    return 1;
  }

  return getCanvasDotGridBucketProgress(zoom, index);
};
