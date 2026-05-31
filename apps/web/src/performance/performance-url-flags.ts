import { PERF_SPANS } from "@punchpress/engine";

const hasUrlFlag = (name: string) => {
  if (typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).has(name);
};

const getUrlFlagValue = (name: string) => {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get(name);
};

export const shouldDisableCanvasOverlay = () => {
  return hasUrlFlag("perf-no-overlay");
};

export const getPerfTimingLogConfig = () => {
  if (!(hasUrlFlag("perf-log") || hasUrlFlag("perf-log-selection"))) {
    return null;
  }

  const thresholdMs = Number(getUrlFlagValue("perf-log-threshold") ?? 0);

  return {
    enabled: true,
    labels: hasUrlFlag("perf-log-selection")
      ? [
          "pointer.down*",
          "selection.*",
          "store.selection*",
          "transform.*",
          "layers.*",
          "render.*",
          PERF_SPANS.hoverNodeSet,
        ]
      : undefined,
    thresholdMs: Number.isFinite(thresholdMs) ? thresholdMs : 0,
  };
};
