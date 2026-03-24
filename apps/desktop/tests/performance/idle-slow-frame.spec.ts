import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
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
} from "../../../web/tests/performance/helpers/idle-slow-frame";
import {
  launchDesktopPerformanceApp,
  startElectronTraceCapture,
} from "./helpers/electron-performance-app";

const shouldCaptureElectronTrace =
  process.env.PUNCHPRESS_CAPTURE_ELECTRON_TRACE === "1";
const DESKTOP_IDLE_SOAK_THRESHOLDS = {
  maxFrameMs: 20,
  p95FrameMs: 10,
  slowFrameCount: 0,
};

test.describe.configure({ mode: "serial" });

test(`desktop-${idleSoakScenarioId}`, async ({ browserName }, testInfo) => {
  testInfo.annotations.push({
    type: "browser",
    description: browserName || "electron",
  });
  test.setTimeout(idleWarmupMs + idleSoakMs + 45_000);
  const artifactDirectory = path.join(process.cwd(), ".context", "performance");
  const snapshotArtifactPath = path.join(
    artifactDirectory,
    `desktop-${idleSoakScenarioId}-snapshot.json`
  );
  const traceArtifactPath = path.join(
    artifactDirectory,
    `desktop-${idleSoakScenarioId}-trace.json`
  );
  const { electronApp, page } = await launchDesktopPerformanceApp();

  try {
    await openPerformanceHud(page);
    mkdirSync(artifactDirectory, { recursive: true });

    if (idleWarmupMs > 0) {
      await page.waitForTimeout(idleWarmupMs);
    }

    const initialSnapshot = await getPerformanceSnapshot(page);
    const initialSlowFrameCount =
      initialSnapshot?.recentSlowFrames?.length || 0;
    const traceCapture = shouldCaptureElectronTrace
      ? await startElectronTraceCapture(electronApp)
      : null;

    const snapshot =
      shouldCaptureElectronTrace && shouldStopAfterFirstSlowFrame
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
      const traceOutputPath = await traceCapture.stop(traceArtifactPath);

      await testInfo.attach(`desktop-${idleSoakScenarioId}-trace-path`, {
        body: traceOutputPath,
        contentType: "text/plain",
      });
    }

    await openPerformanceHud(page);
    const finalSnapshot = await getPerformanceSnapshot(page);

    writeFileSync(snapshotArtifactPath, JSON.stringify(finalSnapshot, null, 2));

    await testInfo.attach(`desktop-${idleSoakScenarioId}-snapshot`, {
      body: JSON.stringify(finalSnapshot, null, 2),
      contentType: "application/json",
    });

    const result = getCompletedBenchmarkResult(
      finalSnapshot,
      idleSoakScenarioId
    );

    expect(result).not.toBeNull();

    const summaryLine = formatBenchmarkReadout(result, [
      `recentSlowFrames=${finalSnapshot?.recentSlowFrames?.length || 0}`,
    ]);

    console.log(summaryLine);
    await testInfo.attach(`desktop-${idleSoakScenarioId}-summary`, {
      body: summaryLine,
      contentType: "text/plain",
    });

    expect(finalSnapshot?.hudOpen).toBe(true);
    expect(Array.isArray(finalSnapshot?.recentSlowFrames)).toBe(true);
    expect(Array.isArray(finalSnapshot?.liveSeconds)).toBe(true);
    expect(result?.summary.slowFrameCount).toBe(
      DESKTOP_IDLE_SOAK_THRESHOLDS.slowFrameCount
    );
    expect(result?.summary.p95FrameMs || 0).toBeLessThanOrEqual(
      DESKTOP_IDLE_SOAK_THRESHOLDS.p95FrameMs
    );
    expect(result?.summary.maxFrameMs || 0).toBeLessThanOrEqual(
      DESKTOP_IDLE_SOAK_THRESHOLDS.maxFrameMs
    );
  } finally {
    await electronApp.close();
  }
});
