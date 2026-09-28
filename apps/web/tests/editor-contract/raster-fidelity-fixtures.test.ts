import { describe, expect, test } from "bun:test";
import {
  compareRasterDabsExact,
  createRasterOperationRecorder,
  createRasterStroke,
  RASTER_FIDELITY_FIXTURE_VERSION,
  type RasterFidelityFixtureSuite,
  type RasterTarget,
} from "@punchpress/engine";
import fixtureData from "../../../../packages/engine/fixtures/raster-fidelity-v1.json";

const fixtures = fixtureData as RasterFidelityFixtureSuite;
const target: RasterTarget = {
  bounds: { height: 200, width: 200, x: -50, y: -50 },
  id: "fidelity-target",
  pixelSize: { height: 200, width: 200 },
};

describe("raster fidelity fixtures", () => {
  test("hard, soft, sampled, erase, spacing, and zoom cases match", () => {
    expect(fixtures.version).toBe(RASTER_FIDELITY_FIXTURE_VERSION);
    expect(fixtures.cases.map(({ id }) => id)).toEqual([
      "hard-click",
      "soft-stroke",
      "sampled-click",
      "erase-click",
      "spacing-residual",
      "zoom-invariance",
    ]);

    for (const fixture of fixtures.cases) {
      for (const inputBatches of fixture.inputVariants) {
        const [firstBatch, ...remainingBatches] = inputBatches;
        const [point, ...remainingFirstBatch] = firstBatch;
        const recorder = createRasterOperationRecorder();
        const stroke = createRasterStroke({
          operation: fixture.operation,
          point,
          settings: fixture.settings,
          surface: recorder,
          target,
        });

        stroke.append(remainingFirstBatch);

        for (const batch of remainingBatches) {
          stroke.append(batch);
        }

        stroke.commit();

        const recorded = recorder.commits[0];
        const comparison = compareRasterDabsExact(
          recorded?.dabs ?? [],
          fixture.expectedDabs
        );

        expect(
          comparison.matches,
          `${fixture.id}: ${comparison.differences.join("; ")}`
        ).toBe(true);
        expect(recorded?.context.operation).toBe(fixture.operation);
      }
    }
  });
});
