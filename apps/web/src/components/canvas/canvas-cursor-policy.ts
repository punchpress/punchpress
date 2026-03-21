export const CANVAS_CURSOR_TOKENS = {
  textPathSlide: "text-path-slide",
} as const;

export const getTextPathHandleCursorToken = (role) => {
  if (role === "position") {
    return CANVAS_CURSOR_TOKENS.textPathSlide;
  }

  return null;
};

export const setActiveCanvasCursorToken = (hostElement, token) => {
  if (!hostElement) {
    return;
  }

  if (token) {
    hostElement.dataset.activeCanvasCursor = token;
    return;
  }

  delete hostElement.dataset.activeCanvasCursor;
};
