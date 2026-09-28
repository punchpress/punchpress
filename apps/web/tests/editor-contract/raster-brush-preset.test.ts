import { describe, expect, test } from "bun:test";
import {
  defineRasterBrushPreset,
  getRasterBrushPreset,
  PUNCHPRESS_RASTER_BRUSH_PRESET_VERSION,
  RASTER_BRUSH_PRESETS,
  type RasterStrokeSettings,
} from "@punchpress/engine";

describe("native raster brush presets", () => {
  test("ships the immutable curated preset catalog", () => {
    expect(RASTER_BRUSH_PRESETS.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "hard-round", name: "Hard Round" },
      { id: "soft-round", name: "Soft Round" },
      { id: "ink", name: "Ink" },
      { id: "pencil", name: "Pencil" },
      { id: "marker", name: "Marker" },
      { id: "chalk", name: "Chalk" },
      { id: "grain", name: "Grain" },
      { id: "pixel", name: "Pixel" },
    ]);

    expect(Object.isFrozen(RASTER_BRUSH_PRESETS)).toBe(true);
    expect(Object.isFrozen(getRasterBrushPreset("chalk")?.settings)).toBe(true);
  });

  test("defines a versioned PunchPress descriptor without a stroke color", () => {
    const preset = defineRasterBrushPreset({
      id: "sampled-charcoal",
      name: "Sampled Charcoal",
      settings: {
        angle: 15,
        angleJitter: 0.2,
        flow: 0.45,
        hardness: 0.65,
        opacity: 0.8,
        roundness: 0.75,
        scatter: 0.1,
        size: 32,
        sizeJitter: 0.15,
        smoothing: 0.2,
        spacing: 0.15,
        tip: { kind: "sampled", sampleId: "charcoal-01" },
      },
    });

    expect(preset).toEqual({
      format: "punchpress-raster-brush",
      id: "sampled-charcoal",
      name: "Sampled Charcoal",
      settings: {
        angle: 15,
        angleJitter: 0.2,
        flow: 0.45,
        hardness: 0.65,
        opacity: 0.8,
        roundness: 0.75,
        scatter: 0.1,
        size: 32,
        sizeJitter: 0.15,
        smoothing: 0.2,
        spacing: 0.15,
        tip: { kind: "sampled", sampleId: "charcoal-01" },
      },
      version: 1,
    });
    expect(PUNCHPRESS_RASTER_BRUSH_PRESET_VERSION).toBe(1);
    expect(Object.isFrozen(preset.settings.tip)).toBe(true);
  });

  test("rejects invalid preset dynamics", () => {
    expect(() =>
      defineRasterBrushPreset({
        id: "invalid",
        name: "Invalid",
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
          smoothing: -0.1,
          spacing: 0,
          tip: { kind: "round" },
        },
      })
    ).toThrow("Raster smoothing must be a non-negative finite number");
  });

  test("strips color from structurally compatible Stroke settings", () => {
    const strokeSettings: RasterStrokeSettings = {
      angle: 0,
      angleJitter: 0,
      color: "#FF0000",
      flow: 1,
      hardness: 1,
      opacity: 1,
      roundness: 1,
      scatter: 0,
      seed: 42,
      size: 24,
      sizeJitter: 0,
      smoothing: 0,
      spacing: 0,
      tip: { kind: "round" },
    };
    const preset = defineRasterBrushPreset({
      id: "hard-round",
      name: "Hard Round",
      settings: strokeSettings,
    });

    expect(preset.settings).not.toHaveProperty("color");
    expect(preset.settings).not.toHaveProperty("seed");
  });
});
