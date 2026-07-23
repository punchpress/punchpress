import type { RasterStrokeSettings } from "./contracts";

type RasterDynamics = Pick<
  RasterStrokeSettings,
  "hardness" | "opacity" | "size" | "smoothing" | "spacing" | "tip"
>;

export const assertValidRasterDynamics = (settings: RasterDynamics): void => {
  assertInUnitRange(settings.hardness, "Raster hardness");
  assertInUnitRange(settings.opacity, "Raster opacity");

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

const assertInUnitRange = (value: number, name: string) => {
  if (!(Number.isFinite(value) && value >= 0 && value <= 1)) {
    throw new Error(`${name} must be between 0 and 1`);
  }
};
