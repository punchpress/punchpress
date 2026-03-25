import { expect, test } from "@playwright/test";
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
  const nodeRenderCount = result?.counters["render.canvas.node"] ?? 0;

  expect(result?.nodeStats.selectedNodeCount).toBe(50);
  expect(nodeRenderCount).toBeLessThanOrEqual(5);
});

test("500-node drag does not rerender node wrappers during motion", async ({
  page,
}) => {
  const result = await runBenchmark(page, "text-nodes-dragging-500");
  const nodeRenderCount = result?.counters["render.canvas.node"] ?? 0;

  expect(result?.nodeStats.selectedNodeCount).toBe(500);
  expect(nodeRenderCount).toBeLessThanOrEqual(20);
});
