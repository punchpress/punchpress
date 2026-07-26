import type { RasterBrushTip, RasterStrokeSettings } from "./contracts";
import { assertValidRasterDynamics } from "./settings";

export const PUNCHPRESS_RASTER_BRUSH_PRESET_VERSION = 1 as const;

export type RasterBrushPresetSettings = Omit<
  RasterStrokeSettings,
  "color" | "seed" | "tip"
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
  assertValidRasterDynamics({ ...settings, seed: 1 });

  return Object.freeze({
    format: "punchpress-raster-brush",
    id,
    name,
    settings: Object.freeze({
      angle: settings.angle,
      angleJitter: settings.angleJitter,
      flow: settings.flow,
      hardness: settings.hardness,
      opacity: settings.opacity,
      roundness: settings.roundness,
      scatter: settings.scatter,
      size: settings.size,
      sizeJitter: settings.sizeJitter,
      smoothing: settings.smoothing,
      spacing: settings.spacing,
      tip: Object.freeze({ ...settings.tip }),
    }),
    version: PUNCHPRESS_RASTER_BRUSH_PRESET_VERSION,
  });
};

type BuiltInPresetInput = Pick<RasterBrushPresetInput, "id" | "name"> & {
  settings: Partial<RasterBrushPresetSettings>;
};

const defineBuiltIn = (input: BuiltInPresetInput): RasterBrushPreset =>
  defineRasterBrushPreset({
    ...input,
    settings: {
      angle: 0,
      angleJitter: 0,
      flow: 1,
      hardness: 1,
      opacity: 1,
      roundness: 1,
      scatter: 0,
      size: 24,
      sizeJitter: 0,
      smoothing: 0.1,
      spacing: 0,
      tip: { kind: "round" },
      ...input.settings,
    },
  });

export const RASTER_BRUSH_PRESETS = Object.freeze([
  defineBuiltIn({
    id: "hard-round",
    name: "Hard Round",
    settings: {},
  }),
  defineBuiltIn({
    id: "soft-round",
    name: "Soft Round",
    settings: {
      hardness: 0,
      size: 64,
      spacing: 0.12,
    },
  }),
  defineBuiltIn({
    id: "ink",
    name: "Ink",
    settings: {
      angle: -12,
      flow: 0.85,
      hardness: 0.9,
      roundness: 0.35,
      size: 16,
      smoothing: 0.2,
      spacing: 0.06,
    },
  }),
  defineBuiltIn({
    id: "pencil",
    name: "Pencil",
    settings: {
      angleJitter: 0.08,
      flow: 0.35,
      roundness: 0.65,
      scatter: 0.04,
      size: 8,
      sizeJitter: 0.15,
      smoothing: 0.12,
      spacing: 0.08,
      tip: { kind: "sampled", sampleId: "pencil" },
    },
  }),
  defineBuiltIn({
    id: "marker",
    name: "Marker",
    settings: {
      angle: 20,
      flow: 0.25,
      hardness: 0.8,
      opacity: 0.7,
      roundness: 0.25,
      size: 48,
      smoothing: 0.25,
      spacing: 0.05,
    },
  }),
  defineBuiltIn({
    id: "chalk",
    name: "Chalk",
    settings: {
      angleJitter: 0.12,
      flow: 0.45,
      scatter: 0.08,
      size: 36,
      sizeJitter: 0.2,
      smoothing: 0.1,
      spacing: 0.16,
      tip: { kind: "sampled", sampleId: "chalk" },
    },
  }),
  defineBuiltIn({
    id: "grain",
    name: "Grain",
    settings: {
      angleJitter: 0.35,
      flow: 0.25,
      opacity: 0.8,
      scatter: 0.18,
      size: 54,
      sizeJitter: 0.3,
      spacing: 0.18,
      tip: { kind: "sampled", sampleId: "grain" },
    },
  }),
  defineBuiltIn({
    id: "pixel",
    name: "Pixel",
    settings: {
      size: 8,
      smoothing: 0,
      tip: { kind: "sampled", sampleId: "pixel" },
    },
  }),
] satisfies readonly RasterBrushPreset[]);

const presetsById = new Map(
  RASTER_BRUSH_PRESETS.map((preset) => [preset.id, preset])
);

export const getRasterBrushPreset = (
  presetId: string
): RasterBrushPreset | null => presetsById.get(presetId) ?? null;
