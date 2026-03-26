export const CANVAS_CURSOR_TOKENS = {
  textPathBendActive: "text-path-bend-active",
  textPathBend: "text-path-bend",
  textPathSlide: "text-path-slide",
} as const;

export const getTextPathHandleCursorToken = (role) => {
  if (role === "bend" || role === "amplitude" || role === "slant") {
    return CANVAS_CURSOR_TOKENS.textPathBend;
  }

  if (role === "position" || role === "cycles") {
    return CANVAS_CURSOR_TOKENS.textPathSlide;
  }

  return null;
};

export const getActiveTextPathHandleCursorToken = (role) => {
  if (role === "bend" || role === "amplitude" || role === "slant") {
    return CANVAS_CURSOR_TOKENS.textPathBendActive;
  }

  return getTextPathHandleCursorToken(role);
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
