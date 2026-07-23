import { describe, expect, test } from "bun:test";
import {
  createRasterDabGenerator,
  type RasterStrokeSettings,
} from "@punchpress/engine";

const hardRoundSettings: RasterStrokeSettings = {
  color: "#112233",
  hardness: 1,
  opacity: 0.75,
  size: 20,
  smoothing: 0,
  spacing: 0.25,
  tip: { kind: "round" },
};

describe("raster dab generation", () => {
  test("a single document-space point produces one complete dab", () => {
    const generator = createRasterDabGenerator(hardRoundSettings);

    expect(generator.append([{ x: 12, y: 34 }])).toEqual([
      {
        center: { x: 12, y: 34 },
        color: "#112233",
        hardness: 1,
        opacity: 0.75,
        size: 20,
        tip: { kind: "round" },
      },
    ]);
    expect(generator.finish()).toEqual([]);
  });

  test("distance spacing is invariant to event density and batch boundaries", () => {
    const sparse = createRasterDabGenerator(hardRoundSettings);
    const sparseDabs = [
      ...sparse.append([
        { x: 0, y: 0 },
        { x: 12, y: 0 },
        { x: 20, y: 0 },
      ]),
      ...sparse.finish(),
    ];
    const dense = createRasterDabGenerator(hardRoundSettings);
    const denseDabs = [
      ...dense.append([
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 7, y: 0 },
      ]),
      ...dense.append([
        { x: 9, y: 0 },
        { x: 12, y: 0 },
        { x: 13, y: 0 },
        { x: 20, y: 0 },
      ]),
      ...dense.finish(),
    ];

    expect(sparseDabs.map(({ center }) => center)).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 15, y: 0 },
      { x: 20, y: 0 },
    ]);
    expect(denseDabs).toEqual(sparseDabs);
  });

  test("smoothing is document-space and stable across collinear event density", () => {
    const settings = { ...hardRoundSettings, smoothing: 0.5 };
    const sparse = createRasterDabGenerator(settings);
    const sparseDabs = [
      ...sparse.append([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]),
      ...sparse.finish(),
    ];
    const dense = createRasterDabGenerator(settings);
    const denseDabs = [
      ...dense.append([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ]),
      ...dense.append([
        { x: 10, y: 5 },
        { x: 10, y: 10 },
      ]),
      ...dense.finish(),
    ];

    expect(denseDabs).toEqual(sparseDabs);
    expect(sparseDabs[0]?.center).toEqual({ x: 0, y: 0 });
    expect(sparseDabs.some(({ center }) => center.x < 10 && center.y > 0)).toBe(
      true
    );
  });

  test("zero spacing uses the minimum document-space sampling interval", () => {
    const generator = createRasterDabGenerator({
      ...hardRoundSettings,
      size: 20,
      spacing: 0,
    });

    expect(
      generator
        .append([
          { x: 0, y: 0 },
          { x: 3, y: 0 },
        ])
        .map(({ center }) => center)
    ).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  test("soft brushes sample more densely than hard brushes", () => {
    const hard = createRasterDabGenerator({
      ...hardRoundSettings,
      size: 100,
      spacing: 0.18,
    });
    const soft = createRasterDabGenerator({
      ...hardRoundSettings,
      hardness: 0,
      size: 100,
      spacing: 0.18,
    });
    const points = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ];

    expect(hard.append(points).map(({ center }) => center.x)).toEqual([0, 18]);
    expect(soft.append(points).map(({ center }) => center.x)).toEqual([
      0, 4.5, 9, 13.5, 18,
    ]);
  });

  test("rejects invalid smoothing before processing input", () => {
    expect(() =>
      createRasterDabGenerator({
        ...hardRoundSettings,
        smoothing: -0.1,
      })
    ).toThrow("Raster smoothing must be a non-negative finite number");
    expect(() =>
      createRasterDabGenerator({
        ...hardRoundSettings,
        smoothing: Number.NaN,
      })
    ).toThrow("Raster smoothing must be a non-negative finite number");
  });

  test("finish flushes a smoothed tail ending on a guide boundary", () => {
    const generator = createRasterDabGenerator({
      ...hardRoundSettings,
      size: 20,
      smoothing: 1,
      spacing: 0.25,
    });
    const dabs = [
      ...generator.append([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ]),
      ...generator.finish(),
    ];

    expect(dabs.at(-1)?.center).toEqual({ x: 100, y: 0 });
  });
});
