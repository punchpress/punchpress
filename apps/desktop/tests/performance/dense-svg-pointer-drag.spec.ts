import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  formatBenchmarkReadout,
  getCompletedBenchmarkResult,
  getPerformanceSnapshot,
  openPerformanceHud,
  triggerPerformanceBenchmark,
  waitForBenchmarkCompletion,
} from "../../../web/tests/performance/helpers/idle-slow-frame";
import { launchDesktopPerformanceApp } from "./helpers/electron-performance-app";

const benchmarkId = "large-svg-pointer-drag";

test.describe.configure({ mode: "serial" });

test(`desktop-${benchmarkId}`, async ({ browserName }, testInfo) => {
  testInfo.annotations.push({
    type: "browser",
    description: browserName || "electron",
  });
  test.setTimeout(300_000);
  const artifactDirectory = path.join(process.cwd(), ".context", "performance");
  const snapshotArtifactPath = path.join(
    artifactDirectory,
    `desktop-${benchmarkId}-snapshot.json`
  );
  const resultArtifactPath = path.join(
    artifactDirectory,
    `desktop-${benchmarkId}-result.json`
  );
  const { electronApp, page } = await launchDesktopPerformanceApp();

  try {
    await openPerformanceHud(page);
    mkdirSync(artifactDirectory, { recursive: true });

    await triggerPerformanceBenchmark(page, benchmarkId);
    await waitForBenchmarkCompletion({
      page,
      timeoutMs: 300_000,
    });

    const snapshot = await getPerformanceSnapshot(page);
    const result = getCompletedBenchmarkResult(snapshot, benchmarkId);

    expect(snapshot).not.toBeNull();
    expect(result).not.toBeNull();
    expect(result?.error).toBeNull();

    writeFileSync(snapshotArtifactPath, JSON.stringify(snapshot, null, 2));
    writeFileSync(resultArtifactPath, JSON.stringify(result, null, 2));

    const summaryLine = formatBenchmarkReadout(result);

    console.log(summaryLine);
    await testInfo.attach(`desktop-${benchmarkId}-summary`, {
      body: summaryLine,
      contentType: "text/plain",
    });
  } finally {
    await electronApp.close();
  }
});
