import type { RasterStrokeSettings } from "./contracts";

type RasterDynamics = Pick<
  RasterStrokeSettings,
  | "angle"
  | "angleJitter"
  | "flow"
  | "hardness"
  | "opacity"
  | "roundness"
  | "scatter"
  | "seed"
  | "size"
  | "sizeJitter"
  | "smoothing"
  | "spacing"
  | "tip"
>;

export const assertValidRasterDynamics = (settings: RasterDynamics): void => {
  if (!(Number.isFinite(settings.angle) && Math.abs(settings.angle) <= 180)) {
    throw new Error("Raster angle must be between -180 and 180");
  }

  assertInUnitRange(settings.angleJitter, "Raster angle jitter");
  assertInUnitRange(settings.flow, "Raster flow");
  assertInUnitRange(settings.hardness, "Raster hardness");
  assertInUnitRange(settings.opacity, "Raster opacity");
  assertInRange(settings.roundness, 0.01, 1, "Raster roundness");
  assertInUnitRange(settings.scatter, "Raster scatter");
  assertInUnitRange(settings.sizeJitter, "Raster size jitter");

  if (
    !(
      Number.isInteger(settings.seed) &&
      settings.seed >= 0 &&
      settings.seed <= 0xffff_ffff
    )
  ) {
    throw new Error("Raster seed must be an unsigned 32-bit integer");
  }

  if (!(Number.isFinite(settings.size) && settings.size > 0)) {
    throw new Error("Raster size must be a positive finite number");
  }

  if (!(Number.isFinite(settings.spacing) && settings.spacing >= 0)) {
    throw new Error("Raster spacing must be a non-negative finite number");
  }

  if (!(Number.isFinite(settings.smoothing) && settings.smoothing >= 0)) {
    throw new Error("Raster smoothing must be a non-negative finite number");
  }

  if (settings.tip.kind === "sampled" && settings.tip.sampleId.length === 0) {
    throw new Error("A sampled Raster tip requires a sample id");
  }
};

export const getRasterStrokeReach = (
  settings: Pick<RasterStrokeSettings, "scatter" | "size">
) => settings.size * (1 + (settings.scatter ?? 0)) * 0.5;

const assertInUnitRange = (value: number, name: string) => {
  assertInRange(value, 0, 1, name);
};

const assertInRange = (
  value: number,
  min: number,
  max: number,
  name: string
) => {
  if (!(Number.isFinite(value) && value >= min && value <= max)) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
};
