export interface PerfSink {
  incrementCounter: (name: string, amount?: number) => void;
  recordDuration: (label: string, durationMs: number) => void;
}

declare global {
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

export const setPerfSink = (sink: PerfSink | null) => {
  if (sink) {
    globalThis.__PUNCHPRESS_PERF_SINK__ = sink;
    return;
  }

  globalThis.__PUNCHPRESS_PERF_SINK__ = undefined;
};

export const measurePerf = <TValue>(
  label: string,
  callback: () => TValue
): TValue => {
  const sink = getPerfSink();

  if (!sink) {
    return callback();
  }

  const startedAt = getNow();

  try {
    return callback();
  } finally {
    sink.recordDuration(label, Math.max(0, getNow() - startedAt));
  }
};

export const incrementPerfCounter = (name: string, amount = 1) => {
  getPerfSink()?.incrementCounter(name, amount);
};
