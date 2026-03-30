export type TransformCorner = "ne" | "nw" | "se" | "sw";

const CORNER_ROTATION_OFFSET = {
  ne: 0,
  nw: 270,
  se: 90,
  sw: 180,
} as const satisfies Record<TransformCorner, number>;

const SCALE_CURSOR_BASE_ROTATION = 0;
const ROTATION_DEG_REGEX = /rotate\((-?\d+(?:\.\d+)?)deg\)/;

export const getTransformRotationDegrees = (transform?: string) => {
  if (!transform) {
    return 0;
  }

  const match = transform.match(ROTATION_DEG_REGEX);

  return match ? Number.parseFloat(match[1] || "0") : 0;
};

export const getScaleCursorRotationDegrees = (
  corner: TransformCorner,
  nodeRotationDegrees: number
) => {
  return normalizeRotation(
    nodeRotationDegrees +
      CORNER_ROTATION_OFFSET[corner] +
      SCALE_CURSOR_BASE_ROTATION
  );
};

export const getRotateCursorRotationDegrees = (
  corner: TransformCorner,
  nodeRotationDegrees: number
) => {
  return normalizeRotation(
    nodeRotationDegrees + CORNER_ROTATION_OFFSET[corner]
  );
};

const normalizeRotation = (rotationDegrees: number) => {
  const normalizedRotation = rotationDegrees % 360;

  return normalizedRotation < 0
    ? normalizedRotation + 360
    : normalizedRotation;
};
