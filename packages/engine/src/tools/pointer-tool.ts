import { selectToolFromShortcut, Tool } from "./tool";

export class PointerTool extends Tool {
  onCanvasPointerDown() {
    this.editor.clearSelection();
  }

  onNodePointerDown({ event, node }) {
    if (event.shiftKey) {
      this.editor.toggleSelection(node.id);
      return;
    }

    this.editor.ensureSelected(node.id);
  }

  onKeyDown({ key }) {
    if (key === "escape") {
      if (this.editor.selectedNodeIds.length > 0) {
        this.editor.clearSelection();
        return true;
      }

      return false;
    }

    return selectToolFromShortcut(this.editor, key);
  }
}
