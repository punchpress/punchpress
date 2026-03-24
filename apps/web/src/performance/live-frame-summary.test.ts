import { describe, expect, it } from "bun:test";
import { LiveFrameSummary } from "./live-frame-summary";

const createFrame = (durationMs: number, id: number) => {
  return {
    buckets: {},
    counters: {},
    durationMs,
    id,
    timestamp: id * 10,
  };
};

describe("LiveFrameSummary", () => {
  it("tracks summary stats without sorting the full frame history", () => {
    const summary = new LiveFrameSummary();

    summary.append({ frame: createFrame(8, 1) });
    summary.append({ frame: createFrame(12, 2) });
    summary.append({ frame: createFrame(24, 3) });

    expect(summary.getSummary()).toMatchObject({
      maxFrameMs: 24,
      slowFrameCount: 1,
    });
    expect(summary.getSummary().averageFrameMs).toBeCloseTo((8 + 12 + 24) / 3);
    expect(summary.getSummary().p50FrameMs).toBeGreaterThanOrEqual(12);
    expect(summary.getSummary().p95FrameMs).toBeGreaterThanOrEqual(24);
  });

  it("recomputes max correctly when the evicted frame was the max", () => {
    const summary = new LiveFrameSummary();
    const frames = [createFrame(30, 1), createFrame(10, 2), createFrame(12, 3)];

    for (const frame of frames) {
      summary.append({ frame });
    }

    summary.append({
      evictedFrame: frames[0],
      frame: createFrame(14, 4),
    });

    const nextSummary = summary.getSummary([
      createFrame(10, 2),
      createFrame(12, 3),
      createFrame(14, 4),
    ]);

    expect(nextSummary.maxFrameMs).toBe(14);
    expect(nextSummary.slowFrameCount).toBe(0);
  });
});
