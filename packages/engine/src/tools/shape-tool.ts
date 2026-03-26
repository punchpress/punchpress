import { round } from "../primitives/math";
import { selectToolFromShortcut, Tool } from "./tool";

const getCanvasPoint = (editor, clientX, clientY) => {
  const viewer = editor.viewerRef;
  const host = editor.hostRef;

  if (!(viewer && host)) {
    return { x: 0, y: 0 };
  }

  const rect = host.getBoundingClientRect();

  return {
    x: viewer.getScrollLeft() + (clientX - rect.left) / editor.zoom,
    y: viewer.getScrollTop() + (clientY - rect.top) / editor.zoom,
  };
};

export class ShapeTool extends Tool {
  onCanvasPointerDown({ point }) {
    return this.editor.beginNodePlacement({
      point,
      shape: this.editor.nextShapeKind,
      type: "shape",
    });
  }

  onNodePointerDown({ event }) {
    const point = getCanvasPoint(this.editor, event.clientX, event.clientY);

    return this.editor.beginNodePlacement({
      point: {
        x: round(point.x, 2),
        y: round(point.y, 2),
      },
      shape: this.editor.nextShapeKind,
      type: "shape",
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
