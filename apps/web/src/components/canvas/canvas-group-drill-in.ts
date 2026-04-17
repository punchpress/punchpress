import { isGroupNode } from "@punchpress/engine";

export const drillIntoGroupSelection = (editor, nodeId) => {
  const selectionTargetNodeId = editor.getSelectionTargetNodeId(nodeId);
  const selectionTargetNode = selectionTargetNodeId
    ? editor.getNode(selectionTargetNodeId)
    : null;

  if (!isGroupNode(selectionTargetNode)) {
    return false;
  }

  if (
    editor.selectedNodeIds.length !== 1 ||
    editor.selectedNodeId !== selectionTargetNode.id
  ) {
    editor.select(selectionTargetNode.id);
    return true;
  }

  editor.setFocusedGroup(selectionTargetNode.id);
  editor.select(nodeId);
  return true;
};
