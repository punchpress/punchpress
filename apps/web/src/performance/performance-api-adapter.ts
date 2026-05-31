import type { PerfSpanSample } from "@punchpress/engine";

const PREFIX = "punchpress";

const safeMark = (
  name: string,
  startTime: number,
  detail?: Record<string, unknown>
) => {
  if (typeof performance === "undefined") {
    return;
  }

  try {
    performance.mark(name, detail ? { detail, startTime } : { startTime });
  } catch {
    try {
      performance.mark(name);
    } catch {
      // Performance marks are best-effort diagnostics.
    }
  }
};

const safeMeasure = (
  name: string,
  startMark: string,
  endMark: string,
  detail?: Record<string, unknown>
) => {
  if (typeof performance === "undefined") {
    return;
  }

  try {
    performance.measure(name, {
      detail,
      end: endMark,
      start: startMark,
    });
  } catch {
    try {
      performance.measure(name, startMark, endMark);
    } catch {
      // Missing marks or unsupported detail should not affect app behavior.
    }
  }
};

export class PerformanceApiAdapter {
  spanId = 0;

  recordSpan = (span: PerfSpanSample) => {
    const id = this.spanId;
    this.spanId += 1;

    const measureName = `${PREFIX}:${span.label}`;
    const startMark = `${measureName}:start:${id}`;
    const endMark = `${measureName}:end:${id}`;
    const detail = {
      depth: span.depth,
      durationMs: span.durationMs,
      label: span.label,
    };

    safeMark(startMark, span.startMs, detail);
    safeMark(endMark, span.endMs, detail);
    safeMeasure(measureName, startMark, endMark, detail);
  };
}
