import { describe, expect, it } from "bun:test";
import {
  createSlowFrameDiagnostic,
  getSlowFrameCauseLabel,
  getSlowFrameSummary,
  getTimelineEntrySummary,
} from "./slow-frame-diagnostics";

const createFrame = (
  overrides: Partial<
    Parameters<typeof createSlowFrameDiagnostic>[0]["frame"]
  > = {}
) => {
  return {
    buckets: {},
    counters: {},
    durationMs: 24,
    id: 12,
    timestamp: 500,
    ...overrides,
  };
};

const createTask = (overrides: Record<string, unknown> = {}) => {
  return {
    durationMs: 12,
    endedAt: 500,
    id: "interval:tick:app.tsx",
    isRecurring: true,
    label: "tick",
    scheduler: "interval" as const,
    startedAt: 488,
    ...overrides,
  };
};

describe("slow-frame-diagnostics", () => {
  it("classifies hidden frames before anything else", () => {
    const diagnostic = createSlowFrameDiagnostic({
      frame: createFrame({
        buckets: { "selection.move.by": 4 },
      }),
      isFocused: true,
      overlappingTasks: [],
      recentTaskHotspots: [],
      recentTasks: [],
      timelineEntries: [
        {
          durationMs: 18,
          endTime: 500,
          entryType: "longtask",
          name: "self",
          startTime: 482,
        },
      ],
      visibilityState: "hidden",
    });

    expect(diagnostic.cause).toBe("hidden-window");
  });

  it("classifies focused visible long tasks", () => {
    const diagnostic = createSlowFrameDiagnostic({
      frame: createFrame(),
      isFocused: true,
      overlappingTasks: [],
      recentTaskHotspots: [],
      recentTasks: [],
      timelineEntries: [
        {
          durationMs: 22,
          endTime: 500,
          entryType: "longtask",
          name: "self",
          startTime: 478,
        },
      ],
      visibilityState: "visible",
    });

    expect(diagnostic.cause).toBe("long-task");
    expect(getSlowFrameCauseLabel(diagnostic.cause)).toBe("Long task");
  });

  it("classifies instrumented work when buckets explain the frame", () => {
    const diagnostic = createSlowFrameDiagnostic({
      frame: createFrame({
        buckets: {
          "selection.move.by": 6,
          "selection.bounds": 2,
        },
      }),
      isFocused: true,
      overlappingTasks: [],
      recentTaskHotspots: [],
      recentTasks: [],
      timelineEntries: [],
      visibilityState: "visible",
    });

    expect(diagnostic.cause).toBe("instrumented-work");
    expect(diagnostic.primaryBucket?.label).toBe("selection.move.by");
  });

  it("falls back to scheduler/compositor jitter when nothing is attributed", () => {
    const diagnostic = createSlowFrameDiagnostic({
      frame: createFrame(),
      isFocused: true,
      overlappingTasks: [createTask()],
      recentTaskHotspots: [],
      recentTasks: [createTask()],
      timelineEntries: [],
      visibilityState: "visible",
    });

    expect(diagnostic.cause).toBe("scheduler-jitter");
    expect(getSlowFrameSummary(diagnostic)).toContain("Scheduler / compositor");
    expect(getSlowFrameSummary(diagnostic)).toContain("tick active");
  });

  it("summarizes timeline entry attribution", () => {
    expect(
      getTimelineEntrySummary({
        attribution: [
          {
            containerName: "main",
            containerType: "window",
          },
        ],
        blockingDurationMs: 30,
        durationMs: 51,
        endTime: 100,
        entryType: "longtask",
        name: "self",
        scripts: [
          {
            sourceFunctionName: "tick",
            sourceURL: "http://localhost:4173/src/app.tsx",
          },
        ],
        startTime: 49,
      })
    ).toContain("longtask:self");
  });
});
