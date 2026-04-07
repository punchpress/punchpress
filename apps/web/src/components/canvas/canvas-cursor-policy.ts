export const CANVAS_CURSOR_TOKENS = {
  textPathBendActive: "text-path-bend-active",
  textPathBend: "text-path-bend",
  textPathSlide: "text-path-slide",
  vectorPathBodyActive: "vector-path-body-active",
  vectorPathBody: "vector-path-body",
  vectorPathInsert: "vector-path-insert",
  vectorPathPointActive: "vector-path-point-active",
  vectorPathPoint: "vector-path-point",
} as const;

export interface CanvasCursorCompanion {
  kind: "label";
  offsetX?: number;
  offsetY?: number;
  text: string;
}

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

export const getVectorPathCursorToken = (mode) => {
  if (mode === "body") {
    return CANVAS_CURSOR_TOKENS.vectorPathBody;
  }

  if (mode === "insert") {
    return CANVAS_CURSOR_TOKENS.vectorPathInsert;
  }

  if (mode === "point") {
    return CANVAS_CURSOR_TOKENS.vectorPathPoint;
  }

  return null;
};

export const getActiveVectorPathCursorToken = (mode) => {
  if (mode === "body") {
    return CANVAS_CURSOR_TOKENS.vectorPathBodyActive;
  }

  if (mode === "point") {
    return CANVAS_CURSOR_TOKENS.vectorPathPointActive;
  }

  return null;
};

const setCanvasCursorDataset = (element, datasetKey, token) => {
  if (!element) {
    return;
  }

  if (token) {
    element.dataset[datasetKey] = token;
    return;
  }

  delete element.dataset[datasetKey];
};

export const setCanvasCursorToken = (element, token) => {
  setCanvasCursorDataset(element, "canvasCursor", token);
};

export const setActiveCanvasCursorToken = (hostElement, token) => {
  setCanvasCursorDataset(hostElement, "activeCanvasCursor", token);
};
