import { setPerfSink, type Editor } from "@punchpress/engine";
import type {
  PerformanceBenchmarkContext,
  PerformanceBenchmarkDefinition,
  PerformanceBenchmarkOptions,
  ResolvedPerformanceBenchmarkOptions,
} from "./performance-benchmark-types";

// Keep enough frames for ~120s at 120fps
const MAX_RECENT_FRAMES = 14_400;
const SLOW_FRAME_THRESHOLD_MS = 16.7;
const LIVE_PUBLISH_INTERVAL_MS = 200;

type FrameBuckets = Record<string, number>;
type FrameCounters = Record<string, number>;

export interface PerformanceFrameSample {
  buckets: FrameBuckets;
  counters: FrameCounters;
  durationMs: number;
  id: number;
  timestamp: number;
}

export interface PerformanceSummary {
  averageFrameMs: number;
  fps: number;
  maxFrameMs: number;
  p50FrameMs: number;
  p95FrameMs: number;
  slowFrameCount: number;
}

export interface PerformanceNodeStats {
  selectedNodeCount: number;
  totalNodeCount: number;
  visibleTextNodeCount: number;
}

export interface PerformanceBenchmarkResult {
  benchmarkId: string;
  counters: FrameCounters;
  description: string;
  durationMs: number;
  endedAt: string;
  error: string | null;
  frames: PerformanceFrameSample[];
  label: string;
  nodeStats: PerformanceNodeStats;
  options: ResolvedPerformanceBenchmarkOptions;
  spans: Array<{
    label: string;
    maxMs: number;
    p95Ms: number;
    totalMs: number;
  }>;
  startedAt: string;
  summary: PerformanceSummary;
}

export interface PerformanceState {
  benchmarkElapsedMs: number;
  benchmarkMessage: string | null;
  benchmarkRange: null | {
    endMs: number | null;
    label: string;
    startMs: number;
  };
  benchmarkStatus: "idle" | "running" | "complete" | "error";
  frames: PerformanceFrameSample[];
  hudOpen: boolean;
  lastResult: PerformanceBenchmarkResult | null;
  liveSummary: PerformanceSummary;
  nodeStats: PerformanceNodeStats;
  selectedBenchmarkId: string | null;
}

const getNow = () => {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }

  return Date.now();
};

const toSummary = (frames: PerformanceFrameSample[]): PerformanceSummary => {
  if (frames.length === 0) {
    return {
      averageFrameMs: 0,
      fps: 0,
      maxFrameMs: 0,
      p50FrameMs: 0,
      p95FrameMs: 0,
      slowFrameCount: 0,
    };
  }

  const durations = frames
    .map((frame) => frame.durationMs)
    .sort((left, right) => left - right);
  const totalFrameMs = durations.reduce((sum, duration) => sum + duration, 0);
  const getPercentile = (percentile: number) => {
    const index = Math.min(
      durations.length - 1,
      Math.floor((durations.length - 1) * percentile)
    );

    return durations[index] || 0;
  };
  const averageFrameMs = totalFrameMs / durations.length;

  return {
    averageFrameMs,
    fps: averageFrameMs > 0 ? 1000 / averageFrameMs : 0,
    maxFrameMs: durations.at(-1) || 0,
    p50FrameMs: getPercentile(0.5),
    p95FrameMs: getPercentile(0.95),
    slowFrameCount: durations.filter(
      (duration) => duration > SLOW_FRAME_THRESHOLD_MS
    ).length,
  };
};

const trimFrames = (frames: PerformanceFrameSample[]) => {
  return frames.slice(-MAX_RECENT_FRAMES);
};

const toSpanSummary = (samples: Map<string, number[]>) => {
  return [...samples.entries()]
    .map(([label, durations]) => {
      const sortedDurations = [...durations].sort(
        (left, right) => left - right
      );
      const p95Index = Math.min(
        sortedDurations.length - 1,
        Math.floor((sortedDurations.length - 1) * 0.95)
      );

      return {
        label,
        maxMs: sortedDurations.at(-1) || 0,
        p95Ms: sortedDurations[p95Index] || 0,
        totalMs: sortedDurations.reduce((sum, duration) => sum + duration, 0),
      };
    })
    .sort((left, right) => right.totalMs - left.totalMs);
};

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "Unknown benchmark error.";
};

export class PerformanceController {
  activeCollection: null | {
    benchmark: PerformanceBenchmarkDefinition;
    counters: FrameCounters;
    frames: PerformanceFrameSample[];
    options: ResolvedPerformanceBenchmarkOptions;
    spanSamples: Map<string, number[]>;
    startedAtIso: string;
    startedAtMs: number;
  };

  frameId = 0;
  liveCaptureRetainCount = 0;
  liveFrames: PerformanceFrameSample[] = [];
  liveSummary: PerformanceSummary = toSummary([]);
  listeners = new Set<() => void>();
  pendingBuckets = new Map<string, number>();
  pendingCounters = new Map<string, number>();
  previousTimestamp = 0;
  publishTimeoutId = 0;
  rafId = 0;
  runtimeActive = false;
  runningBenchmarkStartedAtMs = 0;
  runningBenchmarkTimerId = 0;
  state: PerformanceState = {
    benchmarkElapsedMs: 0,
    benchmarkMessage: null,
    benchmarkRange: null,
    benchmarkStatus: "idle",
    frames: [],
    hudOpen: false,
    lastResult: null,
    liveSummary: toSummary([]),
    nodeStats: {
      selectedNodeCount: 0,
      totalNodeCount: 0,
      visibleTextNodeCount: 0,
    },
    selectedBenchmarkId: null,
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => {
    return this.state;
  };

  notify = () => {
    for (const listener of this.listeners) {
      listener();
    }
  };

  setHudOpen = (hudOpen: boolean) => {
    if (this.state.hudOpen === hudOpen) {
      return;
    }

    this.state = {
      ...this.state,
      hudOpen,
    };
    this.notify();
  };

  toggleHud = () => {
    this.setHudOpen(!this.state.hudOpen);
  };

  isRuntimeActive = () => {
    return this.runtimeActive;
  };

  retainLiveCapture = () => {
    this.liveCaptureRetainCount += 1;
    this.syncRuntimeActivity();

    let released = false;

    return () => {
      if (released) {
        return;
      }

      released = true;
      this.liveCaptureRetainCount = Math.max(0, this.liveCaptureRetainCount - 1);
      this.syncRuntimeActivity();
    };
  };

  setSelectedBenchmarkId = (selectedBenchmarkId: string) => {
    if (this.state.selectedBenchmarkId === selectedBenchmarkId) {
      return;
    }

    this.state = {
      ...this.state,
      selectedBenchmarkId,
    };
    this.notify();
  };

  setNodeStats = (nodeStats: PerformanceNodeStats) => {
    const previousNodeStats = this.state.nodeStats;

    if (
      previousNodeStats.totalNodeCount === nodeStats.totalNodeCount &&
      previousNodeStats.visibleTextNodeCount ===
        nodeStats.visibleTextNodeCount &&
      previousNodeStats.selectedNodeCount === nodeStats.selectedNodeCount
    ) {
      return;
    }

    this.state = {
      ...this.state,
      nodeStats,
    };
    this.notify();
  };

  flushLiveSnapshot = () => {
    if (this.publishTimeoutId && typeof window !== "undefined") {
      window.clearTimeout(this.publishTimeoutId);
      this.publishTimeoutId = 0;
    }

    this.state = {
      ...this.state,
      frames: this.liveFrames,
      liveSummary: this.liveSummary,
    };
    this.notify();
  };

  scheduleLivePublish = () => {
    if (
      typeof window === "undefined" ||
      this.publishTimeoutId ||
      this.state.benchmarkStatus === "running"
    ) {
      return;
    }

    this.publishTimeoutId = window.setTimeout(() => {
      this.publishTimeoutId = 0;
      this.flushLiveSnapshot();
    }, LIVE_PUBLISH_INTERVAL_MS);
  };

  startBenchmarkTimer = () => {
    if (typeof window === "undefined") {
      return;
    }

    this.runningBenchmarkStartedAtMs = getNow();
    this.runningBenchmarkTimerId = window.setInterval(() => {
      this.state = {
        ...this.state,
        benchmarkElapsedMs: Math.max(
          0,
          getNow() - this.runningBenchmarkStartedAtMs
        ),
      };
      this.notify();
    }, 250);
  };

  stopBenchmarkTimer = () => {
    if (!(typeof window !== "undefined" && this.runningBenchmarkTimerId)) {
      this.runningBenchmarkStartedAtMs = 0;
      return;
    }

    window.clearInterval(this.runningBenchmarkTimerId);
    this.runningBenchmarkTimerId = 0;
    this.runningBenchmarkStartedAtMs = 0;
  };

  recordDuration = (label: string, durationMs: number) => {
    if (!(durationMs > 0)) {
      return;
    }

    this.pendingBuckets.set(
      label,
      (this.pendingBuckets.get(label) || 0) + durationMs
    );

    if (!this.activeCollection) {
      return;
    }

    const durations = this.activeCollection.spanSamples.get(label) || [];
    durations.push(durationMs);
    this.activeCollection.spanSamples.set(label, durations);
  };

  incrementCounter = (name: string, amount = 1) => {
    this.pendingCounters.set(
      name,
      (this.pendingCounters.get(name) || 0) + amount
    );

    if (!this.activeCollection) {
      return;
    }

    this.activeCollection.counters[name] =
      (this.activeCollection.counters[name] || 0) + amount;
  };

  waitForFrame = () => {
    if (typeof window === "undefined") {
      return Promise.resolve(getNow());
    }

    return new Promise<number>((resolve) => {
      window.requestAnimationFrame(resolve);
    });
  };

  waitForFrames = async (count = 1) => {
    for (let index = 0; index < count; index += 1) {
      await this.waitForFrame();
    }
  };

  beginCollection = (
    benchmark: PerformanceBenchmarkDefinition,
    options: ResolvedPerformanceBenchmarkOptions
  ) => {
    this.activeCollection = {
      benchmark,
      counters: {},
      frames: [],
      options,
      spanSamples: new Map(),
      startedAtIso: new Date().toISOString(),
      startedAtMs: getNow(),
    };
  };

  finishCollection = (error: unknown = null) => {
    if (!this.activeCollection) {
      return null;
    }

    const collection = this.activeCollection;
    this.activeCollection = null;

    return {
      benchmarkId: collection.benchmark.id,
      counters: collection.counters,
      description: collection.benchmark.description,
      durationMs: Math.max(0, getNow() - collection.startedAtMs),
      endedAt: new Date().toISOString(),
      error: error ? getErrorMessage(error) : null,
      frames: collection.frames,
      label: collection.benchmark.label,
      nodeStats: this.state.nodeStats,
      options: collection.options,
      spans: toSpanSummary(collection.spanSamples),
      startedAt: collection.startedAtIso,
      summary: toSummary(collection.frames),
    } satisfies PerformanceBenchmarkResult;
  };

  resolveOptions = (
    benchmark: PerformanceBenchmarkDefinition,
    options: PerformanceBenchmarkOptions = {}
  ) => {
    return {
      ...benchmark.defaultOptions,
      ...options,
    };
  };

  runBenchmark = async (
    editor: Editor,
    benchmark: PerformanceBenchmarkDefinition,
    options: PerformanceBenchmarkOptions = {}
  ) => {
    if (this.state.benchmarkStatus === "running") {
      return this.state.lastResult;
    }

    const resolvedOptions = this.resolveOptions(benchmark, options);
    const context: PerformanceBenchmarkContext = {
      editor,
      options: resolvedOptions,
      waitForFrame: this.waitForFrame,
      waitForFrames: this.waitForFrames,
    };

    this.state = {
      ...this.state,
      benchmarkElapsedMs: 0,
      benchmarkMessage: `Running ${benchmark.label}...`,
      benchmarkRange: {
        endMs: null,
        label: benchmark.label,
        startMs: getNow(),
      },
      benchmarkStatus: "running",
    };
    this.notify();
    this.syncRuntimeActivity();
    this.flushLiveSnapshot();
    this.startBenchmarkTimer();

    try {
      await benchmark.setup?.(context);
      await this.waitForFrames(resolvedOptions.warmupFrames);
      this.beginCollection(benchmark, resolvedOptions);
      await benchmark.run(context);
      await this.waitForFrames(2);

      const result = this.finishCollection();

      const completedAtMs = getNow();

      this.state = {
        ...this.state,
        benchmarkElapsedMs: 0,
        benchmarkMessage: result
          ? `Completed ${benchmark.label}.`
          : `Completed ${benchmark.label}.`,
        benchmarkRange: this.state.benchmarkRange
          ? {
              ...this.state.benchmarkRange,
              endMs: completedAtMs,
            }
          : null,
        benchmarkStatus: "complete",
        lastResult: result,
      };
      this.notify();

      return result;
    } catch (error) {
      const result = this.finishCollection(error);

      const completedAtMs = getNow();

      this.state = {
        ...this.state,
        benchmarkElapsedMs: 0,
        benchmarkMessage: getErrorMessage(error),
        benchmarkRange: this.state.benchmarkRange
          ? {
              ...this.state.benchmarkRange,
              endMs: completedAtMs,
            }
          : null,
        benchmarkStatus: "error",
        lastResult: result,
      };
      this.notify();

      return result;
    } finally {
      this.stopBenchmarkTimer();
      editor.newDocument();
      await this.waitForFrames(1);
      this.flushLiveSnapshot();
      this.syncRuntimeActivity();
    }
  };

  handleAnimationFrame = (timestamp: number) => {
    if (this.previousTimestamp > 0) {
      const frame: PerformanceFrameSample = {
        buckets: Object.fromEntries(this.pendingBuckets),
        counters: Object.fromEntries(this.pendingCounters),
        durationMs: Math.max(0, timestamp - this.previousTimestamp),
        id: this.frameId,
        timestamp,
      };

      this.frameId += 1;
      this.pendingBuckets.clear();
      this.pendingCounters.clear();

      this.liveFrames = trimFrames([...this.liveFrames, frame]);
      this.liveSummary = toSummary(this.liveFrames);

      if (this.activeCollection) {
        this.activeCollection.frames.push(frame);
      }

      this.scheduleLivePublish();
    }

    this.previousTimestamp = timestamp;
    this.rafId = window.requestAnimationFrame(this.handleAnimationFrame);
  };

  start = () => {
    if (typeof window === "undefined" || this.rafId) {
      return;
    }

    this.rafId = window.requestAnimationFrame(this.handleAnimationFrame);
  };

  syncRuntimeActivity = () => {
    const shouldBeActive =
      this.liveCaptureRetainCount > 0 || this.state.benchmarkStatus === "running";

    if (shouldBeActive === this.runtimeActive) {
      return;
    }

    this.runtimeActive = shouldBeActive;

    if (shouldBeActive) {
      setPerfSink({
        incrementCounter: this.incrementCounter,
        recordDuration: this.recordDuration,
      });
      this.start();
      this.notify();
      return;
    }

    setPerfSink(null);
    this.stop();
    this.notify();
  };

  stop = () => {
    if (!(typeof window !== "undefined" && this.rafId)) {
      return;
    }

    if (this.publishTimeoutId) {
      window.clearTimeout(this.publishTimeoutId);
      this.publishTimeoutId = 0;
    }

    this.stopBenchmarkTimer();
    window.cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.previousTimestamp = 0;
  };

  dispose = () => {
    this.liveCaptureRetainCount = 0;
    this.runtimeActive = false;
    setPerfSink(null);
    this.stop();
  };
}
