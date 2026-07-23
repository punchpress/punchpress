import { describe, expect, test } from "bun:test";
import {
  defineRasterBrushPreset,
  PUNCHPRESS_RASTER_BRUSH_PRESET_VERSION,
} from "@punchpress/engine";

describe("native raster brush presets", () => {
  test("defines a versioned PunchPress descriptor without a stroke color", () => {
    const preset = defineRasterBrushPreset({
      id: "sampled-charcoal",
      name: "Sampled Charcoal",
      settings: {
        hardness: 0.65,
        opacity: 0.8,
        size: 32,
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
        hardness: 0.65,
        opacity: 0.8,
        size: 32,
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
          hardness: 1,
          opacity: 1,
          size: 24,
          smoothing: -0.1,
          spacing: 0,
          tip: { kind: "round" },
        },
      })
    ).toThrow("Raster smoothing must be a non-negative finite number");
  });
});
