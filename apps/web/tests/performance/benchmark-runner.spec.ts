import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { findPerformanceBenchmark } from "../../src/performance/performance-benchmarks";
import { gotoEditor } from "../e2e/helpers/editor";
import {
  formatBenchmarkReadout,
  getCompletedBenchmarkResult,
  getPerformanceSnapshot,
  openPerformanceHud,
  triggerPerformanceBenchmark,
  waitForBenchmarkCompletion,
} from "./helpers/idle-slow-frame";

const benchmarkId = process.env.PUNCHPRESS_BENCHMARK_ID || "";
const benchmark = benchmarkId ? findPerformanceBenchmark(benchmarkId) : null;
const benchmarkTimeoutMs = Number(
  process.env.PUNCHPRESS_PERFORMANCE_TIMEOUT_MS || 300_000
);
const artifactDirectory = path.join(process.cwd(), ".context", "performance");
const snapshotArtifactPath =
  process.env.PUNCHPRESS_PERFORMANCE_SNAPSHOT_PATH ||
  path.join(artifactDirectory, `${benchmarkId || "benchmark"}-snapshot.json`);
const resultArtifactPath =
  process.env.PUNCHPRESS_PERFORMANCE_RESULT_PATH ||
  path.join(artifactDirectory, `${benchmarkId || "benchmark"}-result.json`);

test.describe.configure({ mode: "serial" });

test(benchmarkId || "performance-benchmark", async ({ page }, testInfo) => {
  if (!benchmarkId) {
    throw new Error("Missing PUNCHPRESS_BENCHMARK_ID.");
  }

  if (!benchmark) {
    throw new Error(`Unknown benchmark: ${benchmarkId}`);
  }

  test.setTimeout(benchmarkTimeoutMs + 30_000);

  await gotoEditor(page);
  await openPerformanceHud(page);
  mkdirSync(path.dirname(snapshotArtifactPath), { recursive: true });

  await triggerPerformanceBenchmark(page, benchmarkId);
  await waitForBenchmarkCompletion({
    page,
    timeoutMs: benchmarkTimeoutMs,
  });

  const snapshot = await getPerformanceSnapshot(page);
  expect(snapshot).not.toBeNull();

  const result = getCompletedBenchmarkResult(snapshot, benchmarkId);
  expect(result).not.toBeNull();
  expect(result?.error).toBeNull();

  writeFileSync(snapshotArtifactPath, JSON.stringify(snapshot, null, 2));
  writeFileSync(resultArtifactPath, JSON.stringify(result, null, 2));

  await testInfo.attach(`${benchmarkId}-snapshot`, {
    body: JSON.stringify(snapshot, null, 2),
    contentType: "application/json",
  });
  await testInfo.attach(`${benchmarkId}-result`, {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });

  const summaryLine = formatBenchmarkReadout(result, [
    `selected=${result?.nodeStats.selectedNodeCount || 0}`,
    `total=${result?.nodeStats.totalNodeCount || 0}`,
    `visibleText=${result?.nodeStats.visibleTextNodeCount || 0}`,
  ]);

  console.log(summaryLine);
  await testInfo.attach(`${benchmarkId}-summary`, {
    body: summaryLine,
    contentType: "text/plain",
  });
});
