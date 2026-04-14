import { getActiveCanvasCursorCompanion } from "./canvas-cursor-policy";
import { getVectorPenHoverCursorCompanion } from "./canvas-overlay/vector-path/pen-hover";

export const getCanvasCursorCompanion = (editor, state) => {
  return (
    getVectorPenHoverCursorCompanion(editor, state) ||
    getActiveCanvasCursorCompanion(editor.hostRef)
  );
};
