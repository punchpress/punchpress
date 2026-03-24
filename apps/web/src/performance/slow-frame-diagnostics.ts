import type { PerformanceFrameSample } from "./performance-controller";
import type {
  RuntimeTaskHotspot,
  RuntimeTaskRun,
} from "./runtime-task-recorder";

export type SlowFrameCause =
  | "hidden-window"
  | "unfocused-window"
  | "instrumented-work"
  | "long-task"
  | "scheduler-jitter";

export interface PerformanceTimelineEntry {
  attribution: Array<{
    containerId?: string;
    containerName?: string;
    containerSrc?: string;
    containerType?: string;
  }>;
  blockingDurationMs?: number;
  durationMs: number;
  endTime: number;
  entryType: string;
  name: string;
  scripts: Array<{
    durationMs?: number;
    forcedStyleAndLayoutDurationMs?: number;
    invoker?: string;
    invokerType?: string;
    pauseDurationMs?: number;
    sourceCharPosition?: number;
    sourceFunctionName?: string;
    sourceURL?: string;
  }>;
  startTime: number;
}

export interface SlowFrameDiagnostic {
  cause: SlowFrameCause;
  durationMs: number;
  frameId: number;
  instrumentedWorkMs: number;
  isFocused: boolean;
  overlappingTasks: RuntimeTaskRun[];
  primaryBucket: null | {
    durationMs: number;
    label: string;
  };
  recentTaskHotspots: RuntimeTaskHotspot[];
  recentTasks: RuntimeTaskRun[];
  timelineEntries: PerformanceTimelineEntry[];
  timestamp: number;
  visibilityState: DocumentVisibilityState | "unknown";
}

const getPrimaryBucket = (buckets: Record<string, number>) => {
  const entries = Object.entries(buckets).sort(
    (left, right) => right[1] - left[1]
  );
  const [label, durationMs] = entries[0] || [];

  return label && durationMs
    ? {
        durationMs,
        label,
      }
    : null;
};

const classifySlowFrame = ({
  instrumentedWorkMs,
  isFocused,
  timelineEntries,
  visibilityState,
}: {
  instrumentedWorkMs: number;
  isFocused: boolean;
  timelineEntries: PerformanceTimelineEntry[];
  visibilityState: DocumentVisibilityState | "unknown";
}): SlowFrameCause => {
  if (visibilityState !== "visible") {
    return "hidden-window";
  }

  if (!isFocused) {
    return "unfocused-window";
  }

  if (timelineEntries.length > 0) {
    return "long-task";
  }

  if (instrumentedWorkMs > 0) {
    return "instrumented-work";
  }

  return "scheduler-jitter";
};

export const createSlowFrameDiagnostic = ({
  frame,
  isFocused,
  overlappingTasks,
  recentTaskHotspots,
  recentTasks,
  timelineEntries,
  visibilityState,
}: {
  frame: PerformanceFrameSample;
  isFocused: boolean;
  overlappingTasks: RuntimeTaskRun[];
  recentTaskHotspots: RuntimeTaskHotspot[];
  recentTasks: RuntimeTaskRun[];
  timelineEntries: PerformanceTimelineEntry[];
  visibilityState: DocumentVisibilityState | "unknown";
}): SlowFrameDiagnostic => {
  const instrumentedWorkMs = Object.values(frame.buckets).reduce(
    (sum, durationMs) => sum + durationMs,
    0
  );
  const primaryBucket = getPrimaryBucket(frame.buckets);

  return {
    cause: classifySlowFrame({
      instrumentedWorkMs,
      isFocused,
      timelineEntries,
      visibilityState,
    }),
    durationMs: frame.durationMs,
    frameId: frame.id,
    instrumentedWorkMs,
    isFocused,
    overlappingTasks,
    primaryBucket,
    recentTaskHotspots,
    recentTasks,
    timelineEntries,
    timestamp: frame.timestamp,
    visibilityState,
  };
};

export const getSlowFrameCauseLabel = (cause: SlowFrameCause) => {
  switch (cause) {
    case "hidden-window":
      return "Hidden window";
    case "unfocused-window":
      return "Unfocused window";
    case "instrumented-work":
      return "Instrumented work";
    case "long-task":
      return "Long task";
    case "scheduler-jitter":
      return "Scheduler / compositor";
    default:
      return "Unknown";
  }
};

export const getSlowFrameSummary = (diagnostic: SlowFrameDiagnostic) => {
  const causeLabel = getSlowFrameCauseLabel(diagnostic.cause);
  const parts = [causeLabel];

  if (diagnostic.primaryBucket) {
    parts.push(
      `${diagnostic.primaryBucket.label} ${diagnostic.primaryBucket.durationMs.toFixed(1)}ms`
    );
  }

  if (diagnostic.timelineEntries.length > 0) {
    parts.push(`${diagnostic.timelineEntries.length} timeline event(s)`);
  }

  if (diagnostic.overlappingTasks.length > 0) {
    parts.push(`${diagnostic.overlappingTasks[0]?.label} active`);
  }

  if (diagnostic.visibilityState !== "visible") {
    parts.push(diagnostic.visibilityState);
  }

  if (!diagnostic.isFocused) {
    parts.push("unfocused");
  }

  return parts.join(" • ");
};

export const getTaskHotspotSummary = (hotspot: RuntimeTaskHotspot) => {
  const parts = [
    hotspot.label,
    `${hotspot.totalDurationMs.toFixed(1)}ms total`,
    `${hotspot.runCount} runs`,
  ];

  if (hotspot.averageGapMs !== undefined) {
    parts.push(`${hotspot.averageGapMs.toFixed(0)}ms gap`);
  }

  return parts.join(" • ");
};

export const getTimelineEntrySummary = (entry: PerformanceTimelineEntry) => {
  const parts = [
    `${entry.entryType}:${entry.name}`,
    `${entry.durationMs.toFixed(1)}ms`,
  ];
  const firstAttribution = entry.attribution[0];

  if (firstAttribution?.containerType) {
    parts.push(firstAttribution.containerType);
  }

  if (firstAttribution?.containerName) {
    parts.push(firstAttribution.containerName);
  }

  if (firstAttribution?.containerSrc) {
    parts.push(firstAttribution.containerSrc);
  }

  const firstScript = entry.scripts[0];

  if (firstScript?.sourceFunctionName) {
    parts.push(firstScript.sourceFunctionName);
  }

  if (firstScript?.sourceURL) {
    parts.push(
      firstScript.sourceURL.split("/").at(-1) || firstScript.sourceURL
    );
  }

  return parts.join(" • ");
};
