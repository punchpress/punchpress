import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { gotoEditor } from "../e2e/helpers/editor";
import { startChromeTraceCapture } from "./helpers/chrome-trace";
import {
  formatBenchmarkReadout,
  getCompletedBenchmarkResult,
  getPerformanceSnapshot,
  idleSoakMs,
  idleSoakScenarioId,
  idleWarmupMs,
  openPerformanceHud,
  shouldStopAfterFirstSlowFrame,
  traceMinFrameMs,
  traceSettleMs,
  triggerPerformanceBenchmark,
  waitForBenchmarkCompletion,
  waitForNextSlowFrame,
} from "./helpers/idle-slow-frame";

const shouldCaptureChromeTrace =
  process.env.PUNCHPRESS_CAPTURE_CHROME_TRACE === "1";
const BROWSER_IDLE_SOAK_THRESHOLDS = {
  maxFrameMs: 12,
  p95FrameMs: 10,
  slowFrameCount: 0,
};

test.describe.configure({ mode: "serial" });

test(idleSoakScenarioId, async ({ page }, testInfo) => {
  test.setTimeout(idleWarmupMs + idleSoakMs + 30_000);
  const artifactDirectory = path.join(process.cwd(), ".context", "performance");
  const snapshotArtifactPath = path.join(
    artifactDirectory,
    `${idleSoakScenarioId}-snapshot.json`
  );
  const traceArtifactPath = path.join(
    artifactDirectory,
    `${idleSoakScenarioId}-trace.json`
  );

  await gotoEditor(page);
  await openPerformanceHud(page);
  mkdirSync(artifactDirectory, { recursive: true });

  if (idleWarmupMs > 0) {
    await page.waitForTimeout(idleWarmupMs);
  }

  await page.evaluate((enabled) => {
    window.__PUNCHPRESS_ENABLE_FLAME_SPANS__ = enabled;
    window.__PUNCHPRESS_ENABLE_PERFORMANCE_API_MARKS__ = enabled;
  }, shouldCaptureChromeTrace);
  const initialSnapshot = await getPerformanceSnapshot(page);
  const initialSlowFrameCount = initialSnapshot?.recentSlowFrames?.length || 0;
  const traceCapture = shouldCaptureChromeTrace
    ? await startChromeTraceCapture(page)
    : null;

  const snapshot =
    shouldCaptureChromeTrace && shouldStopAfterFirstSlowFrame
      ? await (async () => {
          await triggerPerformanceBenchmark(page, idleSoakScenarioId);

          return await waitForNextSlowFrame({
            initialSlowFrameCount,
            minimumFrameMs: traceMinFrameMs,
            page,
            timeoutMs: idleSoakMs + idleWarmupMs + 5000,
          });
        })()
      : await (async () => {
          await triggerPerformanceBenchmark(page, idleSoakScenarioId);
          await waitForBenchmarkCompletion({
            page,
            timeoutMs: idleSoakMs + idleWarmupMs + 5000,
          });

          return await getPerformanceSnapshot(page);
        })();

  expect(snapshot).not.toBeNull();

  if (
    traceCapture &&
    (snapshot?.recentSlowFrames?.length || 0) > initialSlowFrameCount &&
    traceSettleMs > 0
  ) {
    await page.waitForTimeout(traceSettleMs);
  }

  if (traceCapture) {
    const traceContents = await traceCapture.stop();

    writeFileSync(traceArtifactPath, traceContents);
    await testInfo.attach(`${idleSoakScenarioId}-trace`, {
      body: traceContents,
      contentType: "application/json",
    });
  }

  await openPerformanceHud(page);
  const finalSnapshot = await getPerformanceSnapshot(page);

  writeFileSync(snapshotArtifactPath, JSON.stringify(finalSnapshot, null, 2));

  await testInfo.attach(`${idleSoakScenarioId}-snapshot`, {
    body: JSON.stringify(finalSnapshot, null, 2),
    contentType: "application/json",
  });

  const result = getCompletedBenchmarkResult(finalSnapshot, idleSoakScenarioId);

  expect(result).not.toBeNull();

  const summaryLine = formatBenchmarkReadout(result, [
    `recentSlowFrames=${finalSnapshot?.recentSlowFrames?.length || 0}`,
  ]);

  console.log(summaryLine);
  await testInfo.attach(`${idleSoakScenarioId}-summary`, {
    body: summaryLine,
    contentType: "text/plain",
  });

  expect(finalSnapshot?.hudOpen).toBe(true);
  expect(Array.isArray(finalSnapshot?.recentSlowFrames)).toBe(true);
  expect(Array.isArray(finalSnapshot?.liveSeconds)).toBe(true);
  expect(result?.summary.slowFrameCount).toBe(
    BROWSER_IDLE_SOAK_THRESHOLDS.slowFrameCount
  );
  expect(result?.summary.p95FrameMs || 0).toBeLessThanOrEqual(
    BROWSER_IDLE_SOAK_THRESHOLDS.p95FrameMs
  );
  expect(result?.summary.maxFrameMs || 0).toBeLessThanOrEqual(
    BROWSER_IDLE_SOAK_THRESHOLDS.maxFrameMs
  );
});
