import { selectToolFromShortcut, Tool } from "./tool";

export class PenTool extends Tool {
  onCanvasPointerDown({ point }) {
    return this.editor.beginNodePlacement({
      point,
      type: "vector",
    });
  }

  onNodePointerDown({ point }) {
    return this.editor.beginNodePlacement({
      point,
      type: "vector",
    });
  }

  onKeyDown({ event, key }) {
    if (key === "escape") {
      this.editor.setActiveTool("pointer");
      return true;
    }

    return selectToolFromShortcut(this.editor, key, event);
  }
}
