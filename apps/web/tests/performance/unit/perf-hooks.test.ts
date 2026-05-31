import { afterEach, describe, expect, it } from "bun:test";
import {
  measurePerf,
  PERF_SPANS,
  type PerfSpanSample,
  setPerfSink,
} from "@punchpress/engine";

describe("perf hooks", () => {
  afterEach(() => {
    setPerfSink(null);
  });

  it("records timestamped nested spans with stack depth", () => {
    const spans: PerfSpanSample[] = [];

    setPerfSink({
      incrementCounter: () => undefined,
      recordDuration: () => undefined,
      recordSpan: (span) => {
        spans.push(span);
      },
    });

    measurePerf(PERF_SPANS.selectionSelectApply, () => {
      measurePerf(PERF_SPANS.selectionTargetsResolve, () => "resolved");
    });

    expect(spans.map((span) => span.label)).toEqual([
      PERF_SPANS.selectionTargetsResolve,
      PERF_SPANS.selectionSelectApply,
    ]);
    expect(spans[0]?.depth).toBe(1);
    expect(spans[1]?.depth).toBe(0);
    expect(spans.every((span) => span.endMs >= span.startMs)).toBe(true);
  });
});
