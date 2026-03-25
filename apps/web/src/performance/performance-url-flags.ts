const hasUrlFlag = (name: string) => {
  if (typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).has(name);
};

export const shouldDisableCanvasOverlay = () => {
  return hasUrlFlag("perf-no-overlay");
};
