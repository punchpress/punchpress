import type { Page } from "@playwright/test";
import { IDLE_SOAK_2MIN_DURATION_MS } from "../../../src/performance/benchmarks/idle-soak-benchmark";
import type {
  PerformanceBenchmarkResult,
  PerformanceState,
  PerformanceSummary,
} from "../../../src/performance/performance-controller";

const DEFAULT_IDLE_WARMUP_MS = 5000;
const DEFAULT_TRACE_MIN_FRAME_MS = 50;
const DEFAULT_TRACE_SETTLE_MS = 1500;
export const idleSoakScenarioId = "idle-soak-2min";
export const idleSoakMs = IDLE_SOAK_2MIN_DURATION_MS;
export const idleWarmupMs = Number(
  process.env.PUNCHPRESS_IDLE_WARMUP_MS || DEFAULT_IDLE_WARMUP_MS
);
export const shouldStopAfterFirstSlowFrame =
  process.env.PUNCHPRESS_STOP_ON_FIRST_SLOW_FRAME !== "0";
export const traceMinFrameMs = Number(
  process.env.PUNCHPRESS_TRACE_MIN_FRAME_MS || DEFAULT_TRACE_MIN_FRAME_MS
);
export const traceSettleMs = Number(
  process.env.PUNCHPRESS_TRACE_SETTLE_MS || DEFAULT_TRACE_SETTLE_MS
);

export const getPerformanceSnapshot = async (page: Page) => {
  return await page.evaluate(() => {
    return window.__PUNCHPRESS_PERF__?.getSnapshot() || null;
  });
};

export const getCompletedBenchmarkResult = (
  snapshot: PerformanceState | null | undefined,
  benchmarkId: string
) => {
  const result = snapshot?.lastResult;

  if (!result || result.benchmarkId !== benchmarkId) {
    return null;
  }

  return result;
};

export const formatPerformanceSummary = (
  summary: PerformanceSummary,
  extras: string[] = []
) => {
  const parts = [
    `fps=${Math.round(summary.fps)}`,
    `p50=${summary.p50FrameMs.toFixed(1)}ms`,
    `p95=${summary.p95FrameMs.toFixed(1)}ms`,
    `max=${summary.maxFrameMs.toFixed(1)}ms`,
    `slow=${summary.slowFrameCount}`,
    ...extras,
  ];

  return parts.join(" ");
};

export const formatBenchmarkReadout = (
  result: PerformanceBenchmarkResult,
  extras: string[] = []
) => {
  return `${result.benchmarkId}: ${formatPerformanceSummary(
    result.summary,
    extras
  )}`;
};

export const triggerPerformanceBenchmark = async (
  page: Page,
  benchmarkId: string
) => {
  await page.evaluate((benchmarkId) => {
    window.__PUNCHPRESS_PERF__?.runBenchmark(benchmarkId);
    return undefined;
  }, benchmarkId);
};

export const waitForBenchmarkCompletion = async ({
  page,
  timeoutMs,
}: {
  page: Page;
  timeoutMs: number;
}) => {
  await page.waitForFunction(
    () => {
      return (
        window.__PUNCHPRESS_PERF__?.getSnapshot()?.benchmarkStatus === "running"
      );
    },
    undefined,
    {
      timeout: timeoutMs,
    }
  );

  await page.waitForFunction(
    () => {
      return (
        window.__PUNCHPRESS_PERF__?.getSnapshot()?.benchmarkStatus !== "running"
      );
    },
    undefined,
    {
      timeout: timeoutMs,
    }
  );
};

export const openPerformanceHud = async (page: Page) => {
  await page.evaluate(() => {
    window.__PUNCHPRESS_PERF__?.setHudOpen(true);
  });
};

export const waitForNextSlowFrame = async ({
  initialSlowFrameCount,
  minimumFrameMs,
  page,
  timeoutMs,
}: {
  initialSlowFrameCount: number;
  minimumFrameMs: number;
  page: Page;
  timeoutMs: number;
}) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const snapshot = await getPerformanceSnapshot(page);
    const currentSlowFrameCount = snapshot?.recentSlowFrames?.length || 0;
    const latestSlowFrame = snapshot?.recentSlowFrames?.at(-1) || null;

    if (
      currentSlowFrameCount > initialSlowFrameCount &&
      latestSlowFrame &&
      (latestSlowFrame.cause === "long-task" ||
        latestSlowFrame.durationMs >= minimumFrameMs)
    ) {
      return snapshot;
    }

    await page.waitForTimeout(250);
  }

  return await getPerformanceSnapshot(page);
};
