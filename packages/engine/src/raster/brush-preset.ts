import type { RasterBrushTip, RasterStrokeSettings } from "./contracts";
import { assertValidRasterDynamics } from "./settings";

export const PUNCHPRESS_RASTER_BRUSH_PRESET_VERSION = 1 as const;

export type RasterBrushPresetSettings = Omit<
  RasterStrokeSettings,
  "color" | "tip"
> & {
  tip: RasterBrushTip;
};

export type RasterBrushPreset = {
  readonly format: "punchpress-raster-brush";
  readonly id: string;
  readonly name: string;
  readonly settings: Readonly<Omit<RasterBrushPresetSettings, "tip">> & {
    readonly tip: Readonly<RasterBrushTip>;
  };
  readonly version: typeof PUNCHPRESS_RASTER_BRUSH_PRESET_VERSION;
};

type RasterBrushPresetInput = Pick<RasterBrushPreset, "id" | "name"> & {
  settings: RasterBrushPresetSettings;
};

export const defineRasterBrushPreset = ({
  id,
  name,
  settings,
}: RasterBrushPresetInput): RasterBrushPreset => {
  assertValidRasterDynamics(settings);

  return Object.freeze({
    format: "punchpress-raster-brush",
    id,
    name,
    settings: Object.freeze({
      hardness: settings.hardness,
      opacity: settings.opacity,
      size: settings.size,
      smoothing: settings.smoothing,
      spacing: settings.spacing,
      tip: Object.freeze({ ...settings.tip }),
    }),
    version: PUNCHPRESS_RASTER_BRUSH_PRESET_VERSION,
  });
};
