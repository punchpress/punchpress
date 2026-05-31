import type { PerfSpanLabel } from "./perf-labels";

export interface PerfSpanSample {
  depth: number;
  durationMs: number;
  endMs: number;
  label: PerfSpanLabel | string;
  startMs: number;
}

export interface PerfSink {
  incrementCounter: (name: string, amount?: number) => void;
  recordDuration: (label: string, durationMs: number) => void;
  recordSpan?: (span: PerfSpanSample) => void;
}

export interface PerfLogConfig {
  enabled: boolean;
  labels?: string[];
  thresholdMs?: number;
}

declare global {
  var __PUNCHPRESS_PERF_LOG_CONFIG__: PerfLogConfig | undefined;
  var __PUNCHPRESS_PERF_SINK__: PerfSink | undefined;
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

const getPerfSink = () => {
  return globalThis.__PUNCHPRESS_PERF_SINK__ || null;
};

const spanStack: string[] = [];

export const setPerfSink = (sink: PerfSink | null) => {
  if (sink) {
    globalThis.__PUNCHPRESS_PERF_SINK__ = sink;
    return;
  }

  globalThis.__PUNCHPRESS_PERF_SINK__ = undefined;
};

export const setPerfLogConfig = (config: PerfLogConfig | null) => {
  if (config?.enabled) {
    globalThis.__PUNCHPRESS_PERF_LOG_CONFIG__ = config;
    return;
  }

  globalThis.__PUNCHPRESS_PERF_LOG_CONFIG__ = undefined;
};

const labelMatches = (label: string, patterns: string[] | undefined) => {
  if (!(patterns && patterns.length > 0)) {
    return true;
  }

  return patterns.some((pattern) => {
    if (pattern.endsWith("*")) {
      return label.startsWith(pattern.slice(0, -1));
    }

    return label === pattern;
  });
};

const logMeasuredDuration = (label: string, durationMs: number) => {
  const config = globalThis.__PUNCHPRESS_PERF_LOG_CONFIG__;

  if (
    !(
      config?.enabled &&
      durationMs >= (config.thresholdMs ?? 0) &&
      labelMatches(label, config.labels)
    )
  ) {
    return;
  }

  console.debug(`[perf] ${label} ${durationMs.toFixed(2)}ms`);
};

export const measurePerf = <TValue>(
  label: PerfSpanLabel | string,
  callback: () => TValue
): TValue => {
  const sink = getPerfSink();
  const depth = spanStack.length;
  const startedAt = getNow();
  spanStack.push(label);

  try {
    return callback();
  } finally {
    const endedAt = getNow();
    const durationMs = Math.max(0, endedAt - startedAt);

    if (sink?.recordSpan) {
      sink.recordSpan({
        depth,
        durationMs,
        endMs: endedAt,
        label,
        startMs: startedAt,
      });
    } else {
      sink?.recordDuration(label, durationMs);
    }
    logMeasuredDuration(label, durationMs);
    spanStack.pop();
  }
};

export const recordPerfSpan = ({
  depth = 0,
  durationMs,
  endMs,
  label,
  startMs,
}: PerfSpanSample) => {
  const sink = getPerfSink();

  if (!(durationMs > 0)) {
    return;
  }

  if (sink?.recordSpan) {
    sink.recordSpan({
      depth,
      durationMs,
      endMs,
      label,
      startMs,
    });
  } else {
    sink?.recordDuration(label, durationMs);
  }
  logMeasuredDuration(label, durationMs);
};

export const incrementPerfCounter = (name: string, amount = 1) => {
  getPerfSink()?.incrementCounter(name, amount);
};
