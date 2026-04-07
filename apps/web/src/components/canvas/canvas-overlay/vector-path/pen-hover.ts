import type { PenHoverIntent, PenHoverState } from "@punchpress/engine";
import type { CanvasCursorCompanion } from "../../canvas-cursor-policy";

const PEN_HOVER_LABELS = {
  add: "Add Point",
  close: "Close Path",
  continue: "Continue Path",
  delete: "Delete Point",
} as const;

const PEN_HOVER_CURSOR_MODES = {
  add: "add",
  close: "default",
  continue: "default",
  delete: "minus",
} as const;

export const getPenHoverIntentLabel = (intent: PenHoverIntent) => {
  return PEN_HOVER_LABELS[intent];
};

export const getPenHoverCursorMode = (intent: PenHoverIntent) => {
  return PEN_HOVER_CURSOR_MODES[intent];
};

export const resolveVectorPenHoverAction = (hover: PenHoverState | null) => {
  if (!hover) {
    return null;
  }

  return {
    cursorMode: getPenHoverCursorMode(hover.intent),
    intent: hover.intent,
    label: getPenHoverIntentLabel(hover.intent),
  };
};

export const getVectorPenHoverCursorCompanion = (
  editor,
  state
): CanvasCursorCompanion | null => {
  if (state.activeTool !== "pen" || state.spacePressed) {
    return null;
  }

  const hover = editor.getPenHoverState();
  const action = resolveVectorPenHoverAction(hover);

  if (!(hover && action && state.pathEditingNodeId === hover.nodeId)) {
    return null;
  }

  const editablePathSession = editor.getEditablePathSession(hover.nodeId);

  if (editablePathSession?.backend !== "vector-path") {
    return null;
  }

  return {
    kind: "label",
    offsetX: 28,
    offsetY: -28,
    text: action.label,
  };
};
