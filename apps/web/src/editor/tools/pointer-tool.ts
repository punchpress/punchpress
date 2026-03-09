import { selectToolFromShortcut, Tool } from "./tool";

export class PointerTool extends Tool {
  onCanvasPointerDown() {
    this.editor.clearSelection();
  }

  onNodePointerDown({ node }) {
    this.editor.selectNode(node.id);
  }

  onKeyDown({ key }) {
    if (key === "escape") {
      if (this.editor.selectedNodeId) {
        this.editor.clearSelection();
        return true;
      }

      return false;
    }

    return selectToolFromShortcut(this.editor, key);
  }
}
