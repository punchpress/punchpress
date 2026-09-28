import type {
  RasterDab,
  RasterOperation,
  RasterPoint,
  RasterStrokeSettings,
} from "./contracts";

export const RASTER_FIDELITY_FIXTURE_VERSION = 1 as const;

export type RasterFidelityFixture = {
  expectedDabs: RasterDab[];
  id: string;
  inputVariants: RasterPoint[][][];
  operation: RasterOperation;
  settings: RasterStrokeSettings;
};

export type RasterFidelityFixtureSuite = {
  cases: RasterFidelityFixture[];
  version: typeof RASTER_FIDELITY_FIXTURE_VERSION;
};

export type RasterFidelityComparison = {
  differences: string[];
  matches: boolean;
};

export const compareRasterDabsExact = (
  actual: readonly RasterDab[],
  expected: readonly RasterDab[]
): RasterFidelityComparison => compareRasterDabs(actual, expected, null);

export const compareRasterDabsTolerant = (
  actual: readonly RasterDab[],
  expected: readonly RasterDab[],
  tolerance: number
): RasterFidelityComparison => {
  if (!(Number.isFinite(tolerance) && tolerance >= 0)) {
    throw new Error("Raster fidelity tolerance must be a non-negative number");
  }

  return compareRasterDabs(actual, expected, tolerance);
};

const compareRasterDabs = (
  actual: readonly RasterDab[],
  expected: readonly RasterDab[],
  tolerance: number | null
): RasterFidelityComparison => {
  const differences: string[] = [];

  if (actual.length !== expected.length) {
    differences.push(
      `dab.length: expected ${expected.length}, received ${actual.length}`
    );
  }

  const count = Math.min(actual.length, expected.length);

  for (let index = 0; index < count; index += 1) {
    const actualDab = actual[index];
    const expectedDab = expected[index];
    const path = `dab[${index}]`;

    compareOptionalNumber(
      `${path}.angle`,
      actualDab.angle,
      expectedDab.angle,
      tolerance,
      differences
    );
    compareNumber(
      `${path}.center.x`,
      actualDab.center.x,
      expectedDab.center.x,
      tolerance,
      differences
    );
    compareNumber(
      `${path}.center.y`,
      actualDab.center.y,
      expectedDab.center.y,
      tolerance,
      differences
    );
    compareValue(
      `${path}.color`,
      actualDab.color,
      expectedDab.color,
      differences
    );
    compareOptionalNumber(
      `${path}.flow`,
      actualDab.flow,
      expectedDab.flow,
      tolerance,
      differences
    );
    compareNumber(
      `${path}.hardness`,
      actualDab.hardness,
      expectedDab.hardness,
      tolerance,
      differences
    );
    compareOptionalNumber(
      `${path}.roundness`,
      actualDab.roundness,
      expectedDab.roundness,
      tolerance,
      differences
    );
    compareNumber(
      `${path}.opacity`,
      actualDab.opacity,
      expectedDab.opacity,
      tolerance,
      differences
    );
    compareNumber(
      `${path}.size`,
      actualDab.size,
      expectedDab.size,
      tolerance,
      differences
    );
    compareValue(
      `${path}.tip.kind`,
      actualDab.tip.kind,
      expectedDab.tip.kind,
      differences
    );

    if (actualDab.tip.kind === "sampled" && expectedDab.tip.kind === "sampled") {
      compareValue(
        `${path}.tip.sampleId`,
        actualDab.tip.sampleId,
        expectedDab.tip.sampleId,
        differences
      );
    }
  }

  return {
    differences,
    matches: differences.length === 0,
  };
};

const compareOptionalNumber = (
  path: string,
  actual: number,
  expected: number | undefined,
  tolerance: number | null,
  differences: string[]
) => {
  if (expected !== undefined) {
    compareNumber(path, actual, expected, tolerance, differences);
  }
};

const compareNumber = (
  path: string,
  actual: number,
  expected: number,
  tolerance: number | null,
  differences: string[]
) => {
  const matches =
    tolerance === null
      ? actual === expected
      : Math.abs(actual - expected) <=
        tolerance +
          Number.EPSILON * Math.max(1, Math.abs(actual), Math.abs(expected));

  if (!matches) {
    differences.push(`${path}: expected ${expected}, received ${actual}`);
  }
};

const compareValue = (
  path: string,
  actual: string,
  expected: string,
  differences: string[]
) => {
  if (actual !== expected) {
    differences.push(`${path}: expected ${expected}, received ${actual}`);
  }
};
