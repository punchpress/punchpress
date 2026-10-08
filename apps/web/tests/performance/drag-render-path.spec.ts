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

const runBenchmark = async (page, benchmarkId: string) => {
  await gotoEditor(page);
  await openPerformanceHud(page);
  await triggerPerformanceBenchmark(page, benchmarkId);
  await waitForBenchmarkCompletion({
    page,
    timeoutMs: 300_000,
  });

  const snapshot = await getPerformanceSnapshot(page);
  const result = getCompletedBenchmarkResult(snapshot, benchmarkId);

  expect(result).not.toBeNull();
  expect(result?.error).toBeNull();

  return result;
};

test.describe.configure({ mode: "serial" });

test("50-node drag does not rerender node wrappers during motion", async ({
  page,
}) => {
  const result = await runBenchmark(page, "text-nodes-dragging-50");
  const nodeRenderCount = result?.counters[PERF_COUNTERS.renderCanvasNode] ?? 0;

  expect(result?.nodeStats.selectedNodeCount).toBe(50);
  expect(nodeRenderCount).toBeLessThanOrEqual(5);
});

test("500-node drag does not rerender node wrappers during motion", async ({
  page,
}) => {
  const result = await runBenchmark(page, "text-nodes-dragging-500");
  const nodeRenderCount = result?.counters[PERF_COUNTERS.renderCanvasNode] ?? 0;

  expect(result?.nodeStats.selectedNodeCount).toBe(500);
  expect(nodeRenderCount).toBeLessThanOrEqual(20);
});

test("group drag re-renders only the moved group's art", async ({ page }) => {
  const result = await runBenchmark(
    page,
    "group-actions-drag-section-expanded"
  );
  const artRenderCount =
    result?.counters[PERF_COUNTERS.renderCanvasNodeArt] ?? 0;
  const placedCount =
    result?.counters[PERF_COUNTERS.groupActionsPlacedSurfaces] ?? 0;
  const movedLeafCount =
    result?.counters[PERF_COUNTERS.groupActionsAffectedLeaves] ?? 0;

  // Thousands of placed shells; only the moved leaves re-render, once per
  // committed drag (the benchmark drags four times).
  expect(placedCount).toBeGreaterThan(3000);
  expect(movedLeafCount).toBeLessThan(placedCount / 10);
  expect(artRenderCount).toBeLessThanOrEqual(4 * movedLeafCount);
});

// A whole-group drag moves one presentation root per gesture. Carried
// shadowed layers keep their effects by identity, so layers re-render only
// when each drag commits, never per held frame.
for (const benchmarkId of [
  "group-actions-drag-root-shadow",
  "group-actions-drag-root-shadows",
]) {
  test(`${benchmarkId} moves one root and holds layers still`, async ({
    page,
  }) => {
    const result = await runBenchmark(page, benchmarkId);
    const counters = result?.counters ?? {};
    const dragCount = 4;
    const heldFrames = result?.metrics.find(
      (metric) => metric.label === "drag.heldFrameMs"
    )?.count;
    const filterOwners = counters[PERF_COUNTERS.groupActionsFilterOwners] ?? 0;

    expect(filterOwners).toBe(16);
    expect(counters[PERF_COUNTERS.renderPlacementPreviewRoots]).toBe(dragCount);
    expect(
      counters[PERF_COUNTERS.renderPlacementPreviewWrites]
    ).toBeLessThanOrEqual(heldFrames ?? 0);
    // Each commit re-renders the shadowed sections whose ink moved and
    // their ancestors.
    expect(
      counters[PERF_COUNTERS.renderLayerComposite] ?? 0
    ).toBeLessThanOrEqual(dragCount * (filterOwners + 4));
  });
}
