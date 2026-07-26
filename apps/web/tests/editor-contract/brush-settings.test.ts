import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import {
  getBrushDabCoverage,
  getBrushDabSpacing,
  getErasedAlpha,
  getErasedAlphaByte,
  getPaintedAlpha,
  getPaintedAlphaByte,
} from "../../../../packages/engine/src/tools/brush-mask";

describe("brush settings", () => {
  test("selects presets into independent temporary Brush and Eraser copies", () => {
    const editor = new Editor();

    editor.selectBrushPreset("chalk", "brush");
    editor.setBrushSettings({ flow: 0.2, size: 77 }, "brush");
    editor.selectBrushPreset("pixel", "eraser");

    expect(editor.getBrushToolPresetId("brush")).toBe("chalk");
    expect(editor.getBrushToolSettings("brush")).toMatchObject({
      flow: 0.2,
      size: 77,
      tip: { kind: "sampled", sampleId: "chalk" },
    });
    expect(editor.getBrushToolPresetId("eraser")).toBe("pixel");
    expect(editor.getBrushToolSettings("eraser")).toMatchObject({
      flow: 1,
      size: 8,
      tip: { kind: "sampled", sampleId: "pixel" },
    });

    editor.selectBrushPreset("chalk", "brush");

    expect(editor.getBrushToolSettings("brush")).toMatchObject({
      flow: 0.45,
      size: 36,
    });
  });

  test("updates brush tool settings through the editor facade", () => {
    const editor = new Editor();

    expect(editor.getBrushToolSettings("brush")).toMatchObject({
      angle: 0,
      angleJitter: 0,
      color: "#111111",
      flow: 1,
      hardness: 1,
      opacity: 1,
      roundness: 1,
      scatter: 0,
      seed: 1,
      size: 24,
      sizeJitter: 0,
      smoothing: 0.1,
      spacing: 0,
      tip: { kind: "round" },
    });

    editor.setBrushSettings({
      angle: -45,
      angleJitter: 0.25,
      color: "#FF0033",
      flow: 0.6,
      hardness: 0.35,
      opacity: 0.5,
      roundness: 0.4,
      scatter: 0.8,
      seed: 1234,
      size: 42,
      sizeJitter: 0.3,
      smoothing: 0.75,
      spacing: 1.25,
    });

    expect(editor.getBrushToolSettings("brush")).toEqual({
      angle: -45,
      angleJitter: 0.25,
      color: "#FF0033",
      flow: 0.6,
      hardness: 0.35,
      opacity: 0.5,
      roundness: 0.4,
      scatter: 0.8,
      seed: 1234,
      size: 42,
      sizeJitter: 0.3,
      smoothing: 0.75,
      spacing: 1.25,
      tip: { kind: "round" },
    });
    expect(editor.getBrushToolSettings("eraser")).toMatchObject({
      color: "#111111",
      hardness: 1,
      opacity: 1,
      size: 24,
      spacing: 0,
    });
  });

  test("remembers brush and eraser settings independently", () => {
    const editor = new Editor();

    editor.setBrushSettings({ hardness: 0, size: 40 }, "brush");
    editor.setBrushSettings({ hardness: 1, size: 80 }, "eraser");

    expect(editor.getBrushToolSettings("brush")).toMatchObject({
      hardness: 0,
      size: 40,
    });
    expect(editor.getBrushToolSettings("eraser")).toMatchObject({
      hardness: 1,
      size: 80,
    });

    editor.setActiveTool("brush");
    editor.setBrushSettings({ spacing: 0.5 });
    editor.setActiveTool("eraser");
    editor.setBrushSettings({ spacing: 1.25 });

    expect(editor.getBrushToolSettings("brush").spacing).toBe(0.5);
    expect(editor.getBrushToolSettings("eraser").spacing).toBe(1.25);
  });

  test("clamps brush settings to raster tool ranges", () => {
    const editor = new Editor();

    editor.setBrushSettings({
      angle: 999,
      angleJitter: 10,
      color: "not-a-color",
      flow: Number.NaN,
      hardness: 10,
      opacity: -1,
      roundness: -1,
      scatter: 10,
      seed: -100,
      size: 100_000,
      sizeJitter: 10,
      smoothing: 10,
      spacing: 100,
    });

    expect(editor.getBrushToolSettings("brush")).toEqual({
      angle: 180,
      angleJitter: 1,
      color: "#111111",
      flow: 1,
      hardness: 1,
      opacity: 0,
      roundness: 0.01,
      scatter: 1,
      seed: 0,
      size: 500,
      sizeJitter: 1,
      smoothing: 1,
      spacing: 2,
      tip: { kind: "round" },
    });
  });

  test("allows zero brush spacing", () => {
    const editor = new Editor();

    editor.setBrushSettings({ spacing: -1 });

    expect(editor.getBrushToolSettings("brush").spacing).toBe(0);
  });

  test("uses smooth soft brush dab coverage without a hard center", () => {
    expect(getBrushDabCoverage(0, 1)).toBe(1);
    expect(getBrushDabCoverage(0.5, 1)).toBe(1);
    expect(getBrushDabCoverage(1, 1)).toBe(1);
    expect(getBrushDabCoverage(1.001, 1)).toBe(0);

    const softMidpointCoverage = getBrushDabCoverage(0.25, 0);
    const softNearCenterCoverage = getBrushDabCoverage(0.01, 0);
    const softNextCoverage = getBrushDabCoverage(0.011, 0);

    expect(getBrushDabCoverage(0, 0)).toBeLessThan(0.12);
    expect(softNearCenterCoverage - softNextCoverage).toBeLessThan(0.001);
    expect(softMidpointCoverage).toBeGreaterThan(0);
    expect(softMidpointCoverage).toBeLessThan(0.05);
    expect(getBrushDabCoverage(1, 0)).toBe(0);
  });

  test("hard brush dabs keep antialiased edge coverage", () => {
    const radius = 12;
    const getCoverageAtDistance = (distance) =>
      getBrushDabCoverage((distance * distance) / (radius * radius), 1, radius);

    expect(getCoverageAtDistance(radius - 0.5)).toBe(1);
    expect(getCoverageAtDistance(radius)).toBeCloseTo(0.5);
    expect(getCoverageAtDistance(radius + 0.25)).toBeCloseTo(0.25);
    expect(getCoverageAtDistance(radius + 0.5)).toBe(0);
  });

  test("samples soft brush strokes more densely than hard brush strokes", () => {
    expect(getBrushDabSpacing(100, 0.18, 1)).toBe(18);
    expect(getBrushDabSpacing(100, 0.18, 0)).toBeLessThan(5);
    expect(getBrushDabSpacing(100, 0.18, 0)).toBeGreaterThanOrEqual(1);
  });

  test("byte alpha compositing keeps source-over semantics", () => {
    expect(getPaintedAlphaByte(0, 0.001)).toBe(0);
    expect(getPaintedAlphaByte(254, 0.001)).toBe(254);
    expect(getErasedAlphaByte(254, 0.001)).toBe(254);
  });

  test("float alpha accumulation avoids 8-bit rounding limits", () => {
    let paintedAlpha = 0;

    for (let index = 0; index < 400; index += 1) {
      paintedAlpha = getPaintedAlpha(paintedAlpha, 0.001);
    }

    expect(Math.round(paintedAlpha * 255)).toBe(84);

    let erasedAlpha = 254 / 255;

    for (let index = 0; index < 10_000; index += 1) {
      erasedAlpha = getErasedAlpha(erasedAlpha, 0.001);
    }

    expect(Math.round(erasedAlpha * 255)).toBe(0);
  });

  test("low-alpha paint accumulation is not dominated by dab sample count", () => {
    const sampleAlpha = 0.001;
    const sampleCount = 400;
    const equivalentAlpha = 1 - (1 - sampleAlpha) ** sampleCount;
    let splitSamplesAlpha = 0;
    let combinedSampleAlpha = 0;

    for (let index = 0; index < sampleCount; index += 1) {
      splitSamplesAlpha = getPaintedAlpha(splitSamplesAlpha, sampleAlpha);
    }

    combinedSampleAlpha = getPaintedAlpha(combinedSampleAlpha, equivalentAlpha);

    expect(
      Math.abs(
        Math.round(splitSamplesAlpha * 255) -
          Math.round(combinedSampleAlpha * 255)
      )
    ).toBeLessThanOrEqual(2);
  });
});
