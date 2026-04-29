import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { selectToolFromShortcut, Tool } from "./tool";

const focusNearestGroupAncestor = (editor, node) => {
  let currentNode = node;

  while (currentNode && currentNode.parentId !== ROOT_PARENT_ID) {
    const parentNode = editor.getNode(currentNode.parentId);

    if (!parentNode) {
      return;
    }

    if (parentNode.type === "group") {
      editor.setFocusedGroup(parentNode.id);
      return;
    }

    currentNode = parentNode;
  }
};

export class NodeTool extends Tool {
  onNodePointerDown({ event, node }) {
    const targetNodeId = this.editor.getPathEditingEntryNodeId(node.id);
    const targetNode = this.editor.getNode(targetNodeId);

    if (!(targetNode && this.editor.canStartPathEditing(targetNode.id))) {
      return null;
    }

    event.preventDefault();
    event.stopPropagation();
    focusNearestGroupAncestor(this.editor, targetNode);
    this.editor.startPathEditing(targetNode.id);
    return null;
  }

  onKeyDown({ event, key }) {
    if (key === "escape" && this.editor.pathEditingNodeId) {
      this.editor.stopPathEditing();
      return true;
    }

    return selectToolFromShortcut(this.editor, key, event);
  }
}
