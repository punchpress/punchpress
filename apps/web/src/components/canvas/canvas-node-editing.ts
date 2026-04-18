import { drillIntoGroupSelection } from "./canvas-group-drill-in";

export const openCanvasNodeEditingMode = (editor, nodeId) => {
  if (drillIntoGroupSelection(editor, nodeId)) {
    return true;
  }

  const targetNodeId = editor.getPathEditingEntryNodeId(nodeId) || nodeId;
  const node = editor.getNode(targetNodeId);
  const nodeEditCapabilities = editor.getNodeEditCapabilities(targetNodeId);

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
