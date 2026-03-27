import { drillIntoGroupSelection } from "./canvas-group-drill-in";

export const openCanvasNodeEditingMode = (editor, nodeId) => {
  if (drillIntoGroupSelection(editor, nodeId)) {
    return true;
  }

  const node = editor.getNode(nodeId);
  const nodeEditCapabilities = editor.getNodeEditCapabilities(nodeId);

  if (!(node && nodeEditCapabilities)) {
    return false;
  }

  if (nodeEditCapabilities.canEditText) {
    editor.startEditing(node);
    return true;
  }

  if (nodeEditCapabilities.requiresPathEditing) {
    return editor.startPathEditing(node.id);
  }

  return false;
};
