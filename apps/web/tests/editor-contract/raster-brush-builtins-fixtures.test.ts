import { describe, expect, test } from "bun:test";
import {
  compareRasterDabsExact,
  compareRasterDabsTolerant,
  createRasterDabGenerator,
  RASTER_BRUSH_PRESETS,
  type RasterDab,
  type RasterStrokeSettings,
} from "@punchpress/engine";
import fixtureData from "../../../../packages/engine/fixtures/raster-brush-builtins-v1.json";

interface BuiltInFixture {
  expectedDabs: RasterDab[];
  id: string;
  mode: "exact" | "tolerant";
  settings: RasterStrokeSettings;
}

const fixtures = fixtureData as {
  cases: BuiltInFixture[];
  version: 1;
};

describe("native Raster Brush built-in fixtures", () => {
  test("owns a representative golden for every curated preset", () => {
    expect(fixtures.cases.map(({ id }) => id)).toEqual(
      RASTER_BRUSH_PRESETS.map(({ id }) => id)
    );

    for (const fixture of fixtures.cases) {
      const dabs = createRasterDabGenerator(fixture.settings).append([
        { x: 40, y: 50 },
      ]);
      const comparison =
        fixture.mode === "exact"
          ? compareRasterDabsExact(dabs, fixture.expectedDabs)
          : compareRasterDabsTolerant(dabs, fixture.expectedDabs, 1e-9);

      expect(
        comparison.matches,
        `${fixture.id}: ${comparison.differences.join("; ")}`
      ).toBe(true);
    }
  });
});
