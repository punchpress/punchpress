import { type Editor, setPerfSink } from "@punchpress/engine";
import { LiveFrameBuffer } from "./live-frame-buffer";
import { LiveFrameSummary } from "./live-frame-summary";
import type {
  PerformanceBenchmarkContext,
  PerformanceBenchmarkDefinition,
  PerformanceBenchmarkOptions,
  ResolvedPerformanceBenchmarkOptions,
} from "./performance-benchmark-types";
import {
  type RuntimeTaskHotspot,
  RuntimeTaskRecorder,
  type RuntimeTaskRun,
} from "./runtime-task-recorder";
import {
  createSlowFrameDiagnostic,
  type PerformanceTimelineEntry,
  type SlowFrameDiagnostic,
} from "./slow-frame-diagnostics";

// Keep enough frames for ~120s at 120fps
const MAX_RECENT_FRAMES = 14_400;
const MAX_RECENT_SLOW_FRAMES = 24;
const MAX_RECENT_TIMELINE_ENTRIES = 120;
const SLOW_FRAME_THRESHOLD_MS = 16.7;
const LIVE_HUD_PUBLISH_INTERVAL_MS = 1000;
const LIVE_STATE_PUBLISH_INTERVAL_MS = 1000;
const SLOW_FRAME_TIMELINE_LOOKBACK_MS = 50;
const SLOW_FRAME_TASK_LOOKBACK_MS = 2000;
const MAX_SLOW_FRAME_TASKS = 6;

type FrameBuckets = Record<string, number>;
type FrameCounters = Record<string, number>;

export interface PerformanceFrameSample {
  buckets: FrameBuckets;
  counters: FrameCounters;
  durationMs: number;
  id: number;
  timestamp: number;
}

export interface PerformanceSecondBucket {
  avgMs: number;
  frameCount: number;
  id: number;
  maxMs: number;
  mergedBuckets: Record<string, number>;
  slowCount: number;
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
  hudOpen: boolean;
  lastResult: PerformanceBenchmarkResult | null;
  liveSeconds: PerformanceSecondBucket[];
  liveSummary: PerformanceSummary;
  nodeStats: PerformanceNodeStats;
  recentSlowFrames: SlowFrameDiagnostic[];
  recentTaskHotspots: RuntimeTaskHotspot[];
  selectedBenchmarkId: string | null;
}

export interface PerformanceHudSnapshot {
  benchmarkElapsedMs: number;
  benchmarkRange: PerformanceState["benchmarkRange"];
  isBenchmarkRunning: boolean;
  lastSlowFrame: SlowFrameDiagnostic | null;
  liveSeconds: PerformanceSecondBucket[];
  liveSummary: PerformanceSummary;
  nodeStats: PerformanceNodeStats;
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

const mergeFrameBuckets = (
  target: Record<string, number>,
  nextBuckets: Record<string, number>
) => {
  for (const [label, duration] of Object.entries(nextBuckets)) {
    target[label] = (target[label] || 0) + duration;
  }
};

const readStringMetadata = (value: unknown) => {
  return typeof value === "string" ? value : undefined;
};

const readNumberMetadata = (value: unknown) => {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
};

const toTimelineAttribution = (entry: PerformanceEntry) => {
  if (!("attribution" in entry && Array.isArray(entry.attribution))) {
    return [];
  }

  return entry.attribution.map((item) => ({
    containerId:
      "containerId" in item ? readStringMetadata(item.containerId) : undefined,
    containerName:
      "containerName" in item
        ? readStringMetadata(item.containerName)
        : undefined,
    containerSrc:
      "containerSrc" in item
        ? readStringMetadata(item.containerSrc)
        : undefined,
    containerType:
      "containerType" in item
        ? readStringMetadata(item.containerType)
        : undefined,
  }));
};

const toTimelineScripts = (entry: PerformanceEntry) => {
  if (!("scripts" in entry && Array.isArray(entry.scripts))) {
    return [];
  }

  return entry.scripts.map((script) => ({
    durationMs:
      "duration" in script ? readNumberMetadata(script.duration) : undefined,
    forcedStyleAndLayoutDurationMs:
      "forcedStyleAndLayoutDuration" in script
        ? readNumberMetadata(script.forcedStyleAndLayoutDuration)
        : undefined,
    invoker:
      "invoker" in script ? readStringMetadata(script.invoker) : undefined,
    invokerType:
      "invokerType" in script
        ? readStringMetadata(script.invokerType)
        : undefined,
    pauseDurationMs:
      "pauseDuration" in script
        ? readNumberMetadata(script.pauseDuration)
        : undefined,
    sourceCharPosition:
      "sourceCharPosition" in script
        ? readNumberMetadata(script.sourceCharPosition)
        : undefined,
    sourceFunctionName:
      "sourceFunctionName" in script
        ? readStringMetadata(script.sourceFunctionName)
        : undefined,
    sourceURL:
      "sourceURL" in script ? readStringMetadata(script.sourceURL) : undefined,
  }));
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
  liveFrameBuffer = new LiveFrameBuffer<PerformanceFrameSample>(
    MAX_RECENT_FRAMES
  );
  liveFrameSummary = new LiveFrameSummary();
  liveRecentSlowFrameBuffer = new LiveFrameBuffer<SlowFrameDiagnostic>(
    MAX_RECENT_SLOW_FRAMES
  );
  liveRecentTimelineEntryBuffer = new LiveFrameBuffer<PerformanceTimelineEntry>(
    MAX_RECENT_TIMELINE_ENTRIES
  );
  liveRecentSlowFrames: SlowFrameDiagnostic[] = [];
  liveRecentSlowFramesDirty = false;
  liveSecondBuffer = new LiveFrameBuffer<PerformanceSecondBucket>(120);
  liveSecondBuckets: PerformanceSecondBucket[] = [];
  liveSecondBucketsDirty = false;
  liveFrames: PerformanceFrameSample[] = [];
  liveFramesDirty = false;
  hudListeners = new Set<() => void>();
  hudPublishTimeoutId = 0;
  hudSnapshot: PerformanceHudSnapshot = {
    benchmarkElapsedMs: 0,
    benchmarkRange: null,
    isBenchmarkRunning: false,
    lastSlowFrame: null,
    liveSeconds: [],
    liveSummary: toSummary([]),
    nodeStats: {
      selectedNodeCount: 0,
      totalNodeCount: 0,
      visibleTextNodeCount: 0,
    },
  };
  liveSummary: PerformanceSummary = toSummary([]);
  listeners = new Set<() => void>();
  pendingBuckets = new Map<string, number>();
  pendingCounters = new Map<string, number>();
  previousTimestamp = 0;
  statePublishTimeoutId = 0;
  timelineObserver: PerformanceObserver | null = null;
  taskRecorder =
    typeof window !== "undefined" ? new RuntimeTaskRecorder(window) : null;
  rafId = 0;
  runtimeActive = false;
  runningBenchmarkStartedAtMs = 0;
  runningBenchmarkTimerId = 0;
  state: PerformanceState = {
    benchmarkElapsedMs: 0,
    benchmarkMessage: null,
    benchmarkRange: null,
    benchmarkStatus: "idle",
    hudOpen: false,
    lastResult: null,
    recentSlowFrames: [],
    recentTaskHotspots: [],
    liveSeconds: [],
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

  subscribeHud = (listener: () => void) => {
    this.hudListeners.add(listener);

    return () => {
      this.hudListeners.delete(listener);
    };
  };

  getSnapshot = () => {
    return this.state;
  };

  getHudSnapshot = () => {
    return this.hudSnapshot;
  };

  notify = () => {
    for (const listener of this.listeners) {
      listener();
    }
  };

  notifyHud = () => {
    for (const listener of this.hudListeners) {
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

    if (hudOpen) {
      this.flushHudSnapshot();
      return;
    }

    if (typeof window !== "undefined" && this.hudPublishTimeoutId) {
      window.clearTimeout(this.hudPublishTimeoutId);
      this.hudPublishTimeoutId = 0;
    }
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
      this.liveCaptureRetainCount = Math.max(
        0,
        this.liveCaptureRetainCount - 1
      );
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
    this.scheduleStatePublish();
    this.scheduleHudPublish();
  };

  getLiveFramesSnapshot = () => {
    if (!this.liveFramesDirty) {
      return this.liveFrames;
    }

    this.liveFrames = this.liveFrameBuffer.toArray();
    this.liveFramesDirty = false;

    return this.liveFrames;
  };

  getLiveSummarySnapshot = () => {
    this.liveSummary = this.liveFrameSummary.getSummary(
      this.getLiveFramesSnapshot()
    );
    return this.liveSummary;
  };

  getLiveSecondBucketsSnapshot = () => {
    if (!this.liveSecondBucketsDirty) {
      return this.liveSecondBuckets;
    }

    this.liveSecondBuckets = this.liveSecondBuffer.toArray();
    this.liveSecondBucketsDirty = false;

    return this.liveSecondBuckets;
  };

  getRecentSlowFramesSnapshot = () => {
    if (!this.liveRecentSlowFramesDirty) {
      return this.liveRecentSlowFrames;
    }

    this.liveRecentSlowFrames = this.liveRecentSlowFrameBuffer.toArray();
    this.liveRecentSlowFramesDirty = false;

    return this.liveRecentSlowFrames;
  };

  getFrameTimelineEntries = (frame: PerformanceFrameSample) => {
    const frameStartMs = frame.timestamp - frame.durationMs;
    const minimumStartTime = Math.max(
      0,
      frameStartMs - SLOW_FRAME_TIMELINE_LOOKBACK_MS
    );

    return this.liveRecentTimelineEntryBuffer.toArray().filter((entry) => {
      return (
        entry.startTime < frame.timestamp && entry.endTime > minimumStartTime
      );
    });
  };

  getFrameTaskRuns = (frame: PerformanceFrameSample) => {
    if (!this.taskRecorder) {
      return {
        overlappingTasks: [] as RuntimeTaskRun[],
        recentTaskHotspots: [] as RuntimeTaskHotspot[],
        recentTasks: [] as RuntimeTaskRun[],
      };
    }

    const frameStartMs = frame.timestamp - frame.durationMs;
    const taskRuns = this.taskRecorder.getRecentRunsSince(
      Math.max(0, frame.timestamp - SLOW_FRAME_TASK_LOOKBACK_MS)
    );
    const recentTasks = taskRuns.slice(-MAX_SLOW_FRAME_TASKS);
    const overlappingTasks = taskRuns
      .filter((task) => {
        return task.startedAt < frame.timestamp && task.endedAt > frameStartMs;
      })
      .slice(-MAX_SLOW_FRAME_TASKS);

    return {
      overlappingTasks,
      recentTaskHotspots: this.taskRecorder
        .getTopHotspots(taskRuns)
        .slice(0, 3),
      recentTasks,
    };
  };

  getWindowFocus = () => {
    if (typeof document === "undefined") {
      return true;
    }

    return document.hasFocus();
  };

  getWindowVisibilityState = (): DocumentVisibilityState | "unknown" => {
    if (typeof document === "undefined") {
      return "unknown";
    }

    return document.visibilityState;
  };

  observeTimelineEntries = () => {
    if (
      typeof PerformanceObserver === "undefined" ||
      this.timelineObserver ||
      !Array.isArray(PerformanceObserver.supportedEntryTypes)
    ) {
      return;
    }

    const supportedEntryTypes = PerformanceObserver.supportedEntryTypes.filter(
      (entryType) =>
        entryType === "long-animation-frame" || entryType === "longtask"
    );

    if (supportedEntryTypes.length === 0) {
      return;
    }

    this.timelineObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.liveRecentTimelineEntryBuffer.append({
          attribution: toTimelineAttribution(entry),
          blockingDurationMs:
            "blockingDuration" in entry
              ? readNumberMetadata(entry.blockingDuration)
              : undefined,
          durationMs: entry.duration,
          endTime: entry.startTime + entry.duration,
          entryType: entry.entryType,
          name: entry.name,
          scripts: toTimelineScripts(entry),
          startTime: entry.startTime,
        });
      }
    });
    this.timelineObserver.observe({
      entryTypes: supportedEntryTypes,
    });
  };

  disconnectTimelineObserver = () => {
    this.timelineObserver?.disconnect();
    this.timelineObserver = null;
  };

  recordSlowFrame = (frame: PerformanceFrameSample) => {
    if (!(frame.durationMs > SLOW_FRAME_THRESHOLD_MS)) {
      return;
    }

    const { overlappingTasks, recentTaskHotspots, recentTasks } =
      this.getFrameTaskRuns(frame);

    this.liveRecentSlowFrameBuffer.append(
      createSlowFrameDiagnostic({
        frame,
        isFocused: this.getWindowFocus(),
        overlappingTasks,
        recentTaskHotspots,
        recentTasks,
        timelineEntries: this.getFrameTimelineEntries(frame),
        visibilityState: this.getWindowVisibilityState(),
      })
    );
    this.liveRecentSlowFramesDirty = true;
    this.scheduleHudPublish({ immediate: true });
    this.scheduleStatePublish();
  };

  recordFrameSecondBucket = (frame: PerformanceFrameSample) => {
    const secondId = Math.floor(frame.timestamp / 1000);
    const buckets = this.getLiveSecondBucketsSnapshot();
    const lastSecondBucket = buckets.at(-1);

    if (!(lastSecondBucket && lastSecondBucket.id === secondId)) {
      this.liveSecondBuffer.append({
        avgMs: frame.durationMs,
        frameCount: 1,
        id: secondId,
        maxMs: frame.durationMs,
        mergedBuckets: { ...frame.buckets },
        slowCount: frame.durationMs > SLOW_FRAME_THRESHOLD_MS ? 1 : 0,
      });
      this.liveSecondBucketsDirty = true;
      return;
    }

    const nextFrameCount = lastSecondBucket.frameCount + 1;
    lastSecondBucket.avgMs =
      (lastSecondBucket.avgMs * lastSecondBucket.frameCount +
        frame.durationMs) /
      nextFrameCount;
    lastSecondBucket.frameCount = nextFrameCount;
    lastSecondBucket.maxMs = Math.max(lastSecondBucket.maxMs, frame.durationMs);
    lastSecondBucket.slowCount +=
      frame.durationMs > SLOW_FRAME_THRESHOLD_MS ? 1 : 0;
    mergeFrameBuckets(lastSecondBucket.mergedBuckets, frame.buckets);
  };

  buildHudSnapshot = (): PerformanceHudSnapshot => {
    const liveSeconds = this.getLiveSecondBucketsSnapshot();
    const recentSlowFrames = this.getRecentSlowFramesSnapshot();
    const liveSummary = this.getLiveSummarySnapshot();

    return {
      benchmarkElapsedMs: this.state.benchmarkElapsedMs,
      benchmarkRange: this.state.benchmarkRange,
      isBenchmarkRunning: this.state.benchmarkStatus === "running",
      lastSlowFrame: recentSlowFrames.at(-1) || null,
      liveSeconds,
      liveSummary,
      nodeStats: this.state.nodeStats,
    };
  };

  flushHudSnapshot = () => {
    if (this.hudPublishTimeoutId && typeof window !== "undefined") {
      window.clearTimeout(this.hudPublishTimeoutId);
      this.hudPublishTimeoutId = 0;
    }

    this.hudSnapshot = this.buildHudSnapshot();
    this.notifyHud();
  };

  flushStateSnapshot = () => {
    if (this.statePublishTimeoutId && typeof window !== "undefined") {
      window.clearTimeout(this.statePublishTimeoutId);
      this.statePublishTimeoutId = 0;
    }

    const liveSeconds = this.getLiveSecondBucketsSnapshot();
    const recentSlowFrames = this.getRecentSlowFramesSnapshot();
    const liveSummary = this.getLiveSummarySnapshot();
    const recentTaskHotspots = this.taskRecorder?.getTopHotspots() || [];

    this.state = {
      ...this.state,
      recentSlowFrames,
      recentTaskHotspots,
      liveSeconds,
      liveSummary,
    };
    this.notify();
  };

  scheduleHudPublish = ({ immediate = false } = {}) => {
    if (typeof window === "undefined" || !this.state.hudOpen) {
      return;
    }

    if (immediate && this.hudPublishTimeoutId) {
      window.clearTimeout(this.hudPublishTimeoutId);
      this.hudPublishTimeoutId = 0;
    }

    if (this.hudPublishTimeoutId) {
      return;
    }

    this.hudPublishTimeoutId = window.setTimeout(
      () => {
        this.hudPublishTimeoutId = 0;
        this.flushHudSnapshot();
      },
      immediate ? 0 : LIVE_HUD_PUBLISH_INTERVAL_MS
    );
  };

  scheduleStatePublish = () => {
    if (typeof window === "undefined" || this.statePublishTimeoutId) {
      return;
    }

    this.statePublishTimeoutId = window.setTimeout(() => {
      this.statePublishTimeoutId = 0;
      this.flushStateSnapshot();
    }, LIVE_STATE_PUBLISH_INTERVAL_MS);
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
    this.flushStateSnapshot();
    this.flushHudSnapshot();
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
      if (benchmark.usesScratchDocument !== false) {
        editor.newDocument();
        await this.waitForFrames(1);
      }
      this.flushStateSnapshot();
      this.flushHudSnapshot();
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

      const evictedFrame = this.liveFrameBuffer.append(frame);
      this.liveFramesDirty = true;
      this.liveFrameSummary.append({ evictedFrame, frame });
      this.recordSlowFrame(frame);
      this.recordFrameSecondBucket(frame);

      if (this.activeCollection) {
        this.activeCollection.frames.push(frame);
      }

      this.scheduleHudPublish();
      this.scheduleStatePublish();
    }

    this.previousTimestamp = timestamp;
    this.rafId = window.requestAnimationFrame(this.handleAnimationFrame);
  };

  start = () => {
    if (typeof window === "undefined" || this.rafId) {
      return;
    }

    this.observeTimelineEntries();
    this.rafId = window.requestAnimationFrame(this.handleAnimationFrame);
  };

  syncRuntimeActivity = () => {
    const shouldBeActive =
      this.liveCaptureRetainCount > 0 ||
      this.state.benchmarkStatus === "running";

    if (shouldBeActive === this.runtimeActive) {
      return;
    }

    this.runtimeActive = shouldBeActive;

    if (shouldBeActive) {
      setPerfSink({
        incrementCounter: this.incrementCounter,
        recordDuration: this.recordDuration,
      });
      this.taskRecorder?.install();
      this.start();
      this.notify();
      return;
    }

    setPerfSink(null);
    this.taskRecorder?.uninstall();
    this.stop();
    this.notify();
  };

  stop = () => {
    this.pendingBuckets.clear();
    this.pendingCounters.clear();
    this.previousTimestamp = 0;

    if (typeof window === "undefined") {
      return;
    }

    if (this.hudPublishTimeoutId) {
      window.clearTimeout(this.hudPublishTimeoutId);
      this.hudPublishTimeoutId = 0;
    }

    if (this.statePublishTimeoutId) {
      window.clearTimeout(this.statePublishTimeoutId);
      this.statePublishTimeoutId = 0;
    }

    this.disconnectTimelineObserver();
    this.stopBenchmarkTimer();
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
    }
    this.rafId = 0;
  };

  dispose = () => {
    this.liveCaptureRetainCount = 0;
    this.runtimeActive = false;
    this.liveFrameBuffer.clear();
    this.liveRecentSlowFrameBuffer.clear();
    this.liveRecentTimelineEntryBuffer.clear();
    this.liveRecentSlowFrames = [];
    this.liveRecentSlowFramesDirty = false;
    this.liveSecondBuffer.clear();
    this.liveSecondBuckets = [];
    this.liveSecondBucketsDirty = false;
    this.liveFrames = [];
    this.liveFramesDirty = false;
    this.liveFrameSummary.clear();
    this.liveSummary = toSummary([]);
    this.hudSnapshot = {
      benchmarkElapsedMs: 0,
      benchmarkRange: null,
      isBenchmarkRunning: false,
      lastSlowFrame: null,
      liveSeconds: [],
      liveSummary: toSummary([]),
      nodeStats: {
        selectedNodeCount: 0,
        totalNodeCount: 0,
        visibleTextNodeCount: 0,
      },
    };
    this.taskRecorder?.clear();
    this.taskRecorder?.uninstall();
    setPerfSink(null);
    this.stop();
  };
}
