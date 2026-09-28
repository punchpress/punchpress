import { describe, expect, test } from "bun:test";
import {
  compareRasterDabsExact,
  compareRasterDabsTolerant,
  type RasterDab,
} from "@punchpress/engine";

const expected: RasterDab[] = [
  {
    center: { x: 10, y: 20 },
    color: "#112233",
    hardness: 0.4,
    opacity: 0.8,
    size: 24,
    tip: { kind: "sampled", sampleId: "charcoal-01" },
  },
];

describe("raster fidelity comparison", () => {
  test("reports exact drift while allowing an explicit numeric tolerance", () => {
    const actual = structuredClone(expected);

    actual[0].center.x += 0.001;
    actual[0].opacity += 0.002;

    expect(compareRasterDabsExact(actual, expected)).toEqual({
      differences: [
        "dab[0].center.x: expected 10, received 10.001",
        "dab[0].opacity: expected 0.8, received 0.802",
      ],
      matches: false,
    });
    expect(compareRasterDabsTolerant(actual, expected, 0.002)).toEqual({
      differences: [],
      matches: true,
    });
  });
});
