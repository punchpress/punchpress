import { LiveFrameBuffer } from "./live-frame-buffer";

const MAX_TASK_RUNS = 240;
const MAX_TASK_HOTSPOTS = 8;
const PERFORMANCE_SOURCE_PATTERN =
  /\/src\/(?:performance|components\/performance)\//;
const PROFILER_CALLBACK_NAMES = new Set(["handleAnimationFrame"]);
const SOURCE_PATH_SPLIT_PATTERN = /[():]/;

type AnyTaskCallback = (...args: never[]) => unknown;

export type RuntimeTaskScheduler =
  | "animation-frame"
  | "idle-callback"
  | "interval"
  | "timeout";

export interface RuntimeTaskRun {
  cadenceMs?: number;
  delayMs?: number;
  durationMs: number;
  endedAt: number;
  id: string;
  isRecurring: boolean;
  label: string;
  scheduler: RuntimeTaskScheduler;
  source?: string;
  startedAt: number;
}

export interface RuntimeTaskHotspot {
  averageDurationMs: number;
  averageGapMs?: number;
  isRecurring: boolean;
  label: string;
  maxDurationMs: number;
  runCount: number;
  scheduler: RuntimeTaskScheduler;
  source?: string;
  totalDurationMs: number;
}

interface RuntimeTaskMeta {
  delayMs?: number;
  id: string;
  ignore: boolean;
  isRecurring: boolean;
  label: string;
  scheduler: RuntimeTaskScheduler;
  source?: string;
}

interface RuntimeTaskAggregate {
  cadenceTotalMs: number;
  gapCount: number;
  isRecurring: boolean;
  label: string;
  lastStartedAt?: number;
  maxDurationMs: number;
  runCount: number;
  scheduler: RuntimeTaskScheduler;
  source?: string;
  totalDurationMs: number;
}

type BrowserRuntime = Window &
  typeof globalThis & {
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions
    ) => number;
    cancelIdleCallback?: (id: number) => void;
  };

const getNow = () => {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }

  return Date.now();
};

const isPerformanceSourceLine = (line: string) => {
  return (
    line.includes("performance-controller") ||
    line.includes("/src/performance/") ||
    line.includes("/src/components/performance/")
  );
};

const toSource = ({
  includePerformanceSource = false,
}: {
  includePerformanceSource?: boolean;
} = {}) => {
  const stack = new Error("Runtime task recorder source").stack;

  if (!stack) {
    return undefined;
  }

  return stack
    .split("\n")
    .map((line) => line.trim())
    .find(
      (line) =>
        line.includes("/src/") &&
        !line.includes("runtime-task-recorder") &&
        (includePerformanceSource || !isPerformanceSourceLine(line))
    );
};

const toTaskLabel = ({
  callback,
  scheduler,
  source,
}: {
  callback: AnyTaskCallback;
  scheduler: RuntimeTaskScheduler;
  source?: string;
}) => {
  if (callback.name) {
    return callback.name;
  }

  if (source) {
    const sourcePath = source.split("/src/").at(-1);

    if (sourcePath) {
      return `${scheduler}:${sourcePath.split(SOURCE_PATH_SPLIT_PATTERN)[0]}`;
    }
  }

  return `${scheduler}:anonymous`;
};

const toHotspots = (runs: RuntimeTaskRun[]) => {
  const aggregates = new Map<string, RuntimeTaskAggregate>();

  for (const run of runs) {
    const aggregate =
      aggregates.get(run.id) ||
      ({
        cadenceTotalMs: 0,
        gapCount: 0,
        isRecurring: run.isRecurring,
        label: run.label,
        maxDurationMs: 0,
        runCount: 0,
        scheduler: run.scheduler,
        source: run.source,
        totalDurationMs: 0,
      } satisfies RuntimeTaskAggregate);

    aggregate.runCount += 1;
    aggregate.totalDurationMs += run.durationMs;
    aggregate.maxDurationMs = Math.max(aggregate.maxDurationMs, run.durationMs);

    if (aggregate.lastStartedAt !== undefined) {
      aggregate.cadenceTotalMs += run.startedAt - aggregate.lastStartedAt;
      aggregate.gapCount += 1;
    }

    aggregate.lastStartedAt = run.startedAt;
    aggregates.set(run.id, aggregate);
  }

  return [...aggregates.values()]
    .map((aggregate) => ({
      averageDurationMs: aggregate.totalDurationMs / aggregate.runCount,
      averageGapMs:
        aggregate.gapCount > 0
          ? aggregate.cadenceTotalMs / aggregate.gapCount
          : undefined,
      isRecurring: aggregate.isRecurring,
      label: aggregate.label,
      maxDurationMs: aggregate.maxDurationMs,
      runCount: aggregate.runCount,
      scheduler: aggregate.scheduler,
      source: aggregate.source,
      totalDurationMs: aggregate.totalDurationMs,
    }))
    .sort((left, right) => {
      return (
        right.totalDurationMs - left.totalDurationMs ||
        right.runCount - left.runCount
      );
    });
};

export class RuntimeTaskRecorder {
  private readonly recentRuns = new LiveFrameBuffer<RuntimeTaskRun>(
    MAX_TASK_RUNS
  );
  private isInstalled = false;
  private readonly originalFns = new Map<string, unknown>();
  private readonly runtime: BrowserRuntime;

  constructor(runtime?: BrowserRuntime) {
    this.runtime = runtime || (window as BrowserRuntime);
  }

  clear = () => {
    this.recentRuns.clear();
  };

  getRecentRuns = () => {
    return this.recentRuns.toArray();
  };

  getRecentRunsSince = (minimumStartedAt: number) => {
    return this.recentRuns
      .toArray()
      .filter((run) => run.startedAt >= minimumStartedAt);
  };

  getTopHotspots = (runs = this.getRecentRuns()) => {
    return toHotspots(runs).slice(0, MAX_TASK_HOTSPOTS);
  };

  install = () => {
    if (this.isInstalled) {
      return;
    }

    this.patchTimer("setTimeout", "timeout", false);
    this.patchTimer("setInterval", "interval", true);
    this.patchAnimationFrame();
    this.patchIdleCallback();
    this.isInstalled = true;
  };

  uninstall = () => {
    if (!this.isInstalled) {
      return;
    }

    for (const [name, originalFn] of this.originalFns) {
      (this.runtime as Record<string, unknown>)[name] = originalFn;
    }

    this.originalFns.clear();
    this.isInstalled = false;
  };

  private readonly patchAnimationFrame = () => {
    const original = this.runtime.requestAnimationFrame.bind(this.runtime);
    this.originalFns.set("requestAnimationFrame", original);
    this.runtime.requestAnimationFrame = (callback) => {
      const meta = this.createTaskMeta(
        callback as unknown as AnyTaskCallback,
        "animation-frame",
        true
      );

      return original((timestamp) => {
        this.runTask(meta, () => callback(timestamp));
      });
    };
  };

  private readonly patchIdleCallback = () => {
    if (
      typeof this.runtime.requestIdleCallback !== "function" ||
      typeof this.runtime.cancelIdleCallback !== "function"
    ) {
      return;
    }

    const original = this.runtime.requestIdleCallback.bind(this.runtime);
    this.originalFns.set("requestIdleCallback", original);
    this.runtime.requestIdleCallback = (callback, options) => {
      const meta = this.createTaskMeta(
        callback as unknown as AnyTaskCallback,
        "idle-callback",
        true
      );

      return original((deadline) => {
        this.runTask(meta, () => callback(deadline));
      }, options);
    };
  };

  private readonly patchTimer = (
    name: "setInterval" | "setTimeout",
    scheduler: RuntimeTaskScheduler,
    isRecurring: boolean
  ) => {
    const original = this.runtime[name].bind(this.runtime);
    this.originalFns.set(name, original);
    this.runtime[name] = ((
      handler: TimerHandler,
      delay?: number,
      ...args: unknown[]
    ) => {
      if (typeof handler !== "function") {
        return original(handler, delay, ...args);
      }

      const meta = this.createTaskMeta(handler, scheduler, isRecurring, delay);

      return original(
        (...callbackArgs: unknown[]) => {
          this.runTask(meta, () => handler(...callbackArgs));
        },
        delay,
        ...args
      );
    }) as typeof window.setTimeout;
  };

  private readonly createTaskMeta = (
    callback: AnyTaskCallback,
    scheduler: RuntimeTaskScheduler,
    isRecurring: boolean,
    delayMs?: number
  ): RuntimeTaskMeta => {
    const source = toSource();
    const rawSource = toSource({ includePerformanceSource: true });

    return {
      delayMs,
      id: `${scheduler}:${callback.name || "anonymous"}:${source || "unknown"}`,
      ignore:
        PROFILER_CALLBACK_NAMES.has(callback.name) ||
        !!(rawSource && PERFORMANCE_SOURCE_PATTERN.test(rawSource)),
      isRecurring,
      label: toTaskLabel({ callback, scheduler, source }),
      scheduler,
      source,
    };
  };

  private readonly runTask = (meta: RuntimeTaskMeta, callback: () => void) => {
    if (meta.ignore) {
      callback();
      return;
    }

    const startedAt = getNow();

    try {
      callback();
    } finally {
      const endedAt = getNow();

      this.recentRuns.append({
        cadenceMs: meta.delayMs,
        delayMs: meta.delayMs,
        durationMs: Math.max(0, endedAt - startedAt),
        endedAt,
        id: meta.id,
        isRecurring: meta.isRecurring,
        label: meta.label,
        scheduler: meta.scheduler,
        source: meta.source,
        startedAt,
      });
    }
  };
}

export const getRuntimeTaskSummary = (task: RuntimeTaskRun) => {
  const parts = [task.label, `${task.durationMs.toFixed(1)}ms`, task.scheduler];

  if (task.delayMs !== undefined) {
    parts.push(`${Math.round(task.delayMs)}ms cadence`);
  }

  return parts.join(" • ");
};
