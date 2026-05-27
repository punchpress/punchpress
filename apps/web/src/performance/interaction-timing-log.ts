const getNow = () => {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
};

const isTimingLogEnabled = () => {
  return Boolean(globalThis.__PUNCHPRESS_PERF_LOG_CONFIG__?.enabled);
};

export const getInteractionTimingStart = () => {
  return isTimingLogEnabled() ? getNow() : 0;
};

export const logInteractionCheckpoint = (
  label: string,
  startedAt: number,
  details: Record<string, unknown> = {}
) => {
  if (!(startedAt > 0 && isTimingLogEnabled())) {
    return;
  }

  console.debug(`[perf] ${label} ${(getNow() - startedAt).toFixed(2)}ms`, {
    ...details,
  });
};

export const logInteractionNextPaint = (
  label: string,
  startedAt: number,
  getDetails: () => Record<string, unknown> = () => ({})
) => {
  if (!(startedAt > 0 && isTimingLogEnabled())) {
    return;
  }

  const scheduleTimeout = (frameLabel: string) => {
    window.setTimeout(() => {
      logInteractionCheckpoint(`${label}.${frameLabel}.timeout`, startedAt, {
        ...getDetails(),
      });
    }, 0);
  };

  window.requestAnimationFrame(() => {
    logInteractionCheckpoint(`${label}.raf1`, startedAt, {
      ...getDetails(),
    });
    scheduleTimeout("raf1");

    window.requestAnimationFrame(() => {
      logInteractionCheckpoint(`${label}.raf2`, startedAt, {
        ...getDetails(),
      });
      scheduleTimeout("raf2");
    });
  });
};
