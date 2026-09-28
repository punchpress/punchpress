import type { RasterStrokeSettings } from "./contracts";

const MIN_SOFT_SPACING_MULTIPLIER = 0.25;
const MIN_DAB_SPACING = 1;

type RasterDabSpacingSettings = Pick<
  RasterStrokeSettings,
  "hardness" | "size" | "spacing"
>;

export const getRasterDabSpacing = ({
  hardness,
  size,
  spacing,
}: RasterDabSpacingSettings): number => {
  const hardnessMultiplier =
    MIN_SOFT_SPACING_MULTIPLIER +
    (1 - MIN_SOFT_SPACING_MULTIPLIER) * hardness;

  return Math.max(MIN_DAB_SPACING, size * spacing * hardnessMultiplier);
};
