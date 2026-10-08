import { expect, type Page, test } from "@playwright/test";
import { PERF_COUNTERS } from "@punchpress/engine";
import { gotoEditor } from "../e2e/helpers/editor";
import {
  getCompletedBenchmarkResult,
  getPerformanceSnapshot,
  openPerformanceHud,
  triggerPerformanceBenchmark,
  waitForBenchmarkCompletion,
} from "./helpers/idle-slow-frame";

const FRAMES = 60;
// Slack for frames where the browser splits one frame's edits across commits.
const SLACK = 10;
// Counters collect only during the scrub (after setup and warmup), so they
// count settled updates; mounting the panel for the selection is excluded.
const STRUCTURAL_RENDER_LIMIT = 5;

const runScrub = async (page: Page, benchmarkId: string) => {
  await gotoEditor(page);
  await openPerformanceHud(page);
  await triggerPerformanceBenchmark(page, benchmarkId, { frames: FRAMES });
  await waitForBenchmarkCompletion({ page, timeoutMs: 120_000 });

  const snapshot = await getPerformanceSnapshot(page);
  const result = getCompletedBenchmarkResult(snapshot, benchmarkId);

  expect(result?.error).toBeNull();
  expect(result?.nodeStats.selectedNodeCount).toBe(1);

  return (counter: string) => result?.counters[counter] ?? 0;
};

// A scrub on one of 200 nodes re-renders that node's art and the scrubbed
// value controls. The panel root, its sections, and layer rows stay put.
const expectScrubRenderPath = (
  count: (counter: string) => number,
  scrubbedFieldCount: number
) => {
  // All updates in a frame commit together, so the edited node's art renders
  // about once per frame. A second node re-rendering each frame, or
  // whole-document invalidation (200 per commit), exceeds this.
  expect(count(PERF_COUNTERS.renderCanvasNodeArt)).toBeGreaterThan(0);
  expect(count(PERF_COUNTERS.renderCanvasNodeArt)).toBeLessThanOrEqual(
    FRAMES + SLACK
  );
  expect(count(PERF_COUNTERS.renderCanvasNode)).toBeLessThanOrEqual(5);
  expect(count(PERF_COUNTERS.renderPanelLayers)).toBeLessThanOrEqual(5);
  expect(count(PERF_COUNTERS.renderPanelLayerRow)).toBeLessThanOrEqual(5);
  expect(count(PERF_COUNTERS.renderCanvasOverlay)).toBeLessThanOrEqual(5);
  expect(count(PERF_COUNTERS.renderPanelProperties)).toBeLessThanOrEqual(
    STRUCTURAL_RENDER_LIMIT
  );
  expect(count(PERF_COUNTERS.renderPanelPropertiesSection)).toBeLessThanOrEqual(
    STRUCTURAL_RENDER_LIMIT
  );
  expect(count(PERF_COUNTERS.renderPanelPropertiesRow)).toBeLessThanOrEqual(
    STRUCTURAL_RENDER_LIMIT
  );
  // Each scrubbed control renders about once per frame; untouched controls
  // do not render at all.
  expect(count(PERF_COUNTERS.renderPanelPropertiesField)).toBeGreaterThan(
    FRAMES / 2
  );
  expect(count(PERF_COUNTERS.renderPanelPropertiesField)).toBeLessThanOrEqual(
    scrubbedFieldCount * FRAMES + SLACK
  );
};

test("a two-stroke width scrub on one of 200 nodes re-renders only the node art and both width fields", async ({
  page,
}) => {
  const count = await runScrub(page, "appearance-stroke-scrub-one-of-200");

  expectScrubRenderPath(count, 2);
});

test("a one-stroke width scrub re-renders only that width field", async ({
  page,
}) => {
  const count = await runScrub(
    page,
    "appearance-stroke-scrub-one-of-200-single"
  );

  expectScrubRenderPath(count, 1);
});

test("a shadow x, y, and blur scrub re-renders only those three fields", async ({
  page,
}) => {
  const count = await runScrub(page, "appearance-shadow-scrub");

  expectScrubRenderPath(count, 3);
});

test("a shadow blur scrub re-renders only the blur field", async ({ page }) => {
  const count = await runScrub(page, "appearance-shadow-scrub-blur");

  expectScrubRenderPath(count, 1);
});
