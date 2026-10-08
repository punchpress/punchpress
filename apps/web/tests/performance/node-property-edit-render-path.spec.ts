import { expect, test } from "@playwright/test";
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

test("a property edit on one of 200 nodes re-renders only that node's art and the panel", async ({
  page,
}) => {
  await gotoEditor(page);
  await openPerformanceHud(page);
  await triggerPerformanceBenchmark(
    page,
    "appearance-stroke-scrub-one-of-200",
    { frames: FRAMES }
  );
  await waitForBenchmarkCompletion({ page, timeoutMs: 120_000 });

  const snapshot = await getPerformanceSnapshot(page);
  const result = getCompletedBenchmarkResult(
    snapshot,
    "appearance-stroke-scrub-one-of-200"
  );
  const count = (counter: string) => result?.counters[counter] ?? 0;

  expect(result?.error).toBeNull();
  expect(result?.nodeStats.selectedNodeCount).toBe(1);
  // Both stroke updates in a frame commit together, so the edited node's art
  // renders about once per frame. A second node re-rendering each frame, or
  // whole-document invalidation (200 per commit), exceeds this.
  expect(count(PERF_COUNTERS.renderCanvasNodeArt)).toBeGreaterThan(0);
  expect(count(PERF_COUNTERS.renderCanvasNodeArt)).toBeLessThanOrEqual(
    FRAMES + 10
  );
  expect(count(PERF_COUNTERS.renderCanvasNode)).toBeLessThanOrEqual(5);
  expect(count(PERF_COUNTERS.renderPanelLayers)).toBeLessThanOrEqual(5);
  expect(count(PERF_COUNTERS.renderPanelLayerRow)).toBeLessThanOrEqual(5);
  expect(count(PERF_COUNTERS.renderCanvasOverlay)).toBeLessThanOrEqual(5);
  expect(count(PERF_COUNTERS.renderPanelProperties)).toBeGreaterThan(0);
  expect(count(PERF_COUNTERS.renderPanelProperties)).toBeLessThanOrEqual(
    FRAMES + 10
  );
});
