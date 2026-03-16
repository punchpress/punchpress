import { selectToolFromShortcut, Tool } from "./tool";

export class TextTool extends Tool {
  onCanvasPointerDown({ point }) {
    if (this.editor.editingNodeId) {
      this.editor.finalizeEditing();
      return;
    }

    this.editor.addTextNode(point);
  }

  onNodePointerDown({ node }) {
    this.editor.startEditing(node);
  }

  onKeyDown({ key }) {
    if (key === "escape") {
      this.editor.setActiveTool("pointer");
      return true;
    }

    return selectToolFromShortcut(this.editor, key);
  }
}
