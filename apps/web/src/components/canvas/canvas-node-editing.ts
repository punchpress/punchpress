import { drillIntoGroupSelection } from "./canvas-group-drill-in";
import { getCanvasDeepLeafNodeIdAtPoint } from "./canvas-overlay/vector-path/canvas-node-hit-target";

const getCanvasEditingEntryNodeId = (editor, nodeId, clientPoint) => {
  const defaultTargetNodeId =
    editor.getPathEditingEntryNodeId(nodeId) || nodeId;

  if (
    !(
      clientPoint &&
      typeof clientPoint.x === "number" &&
      typeof clientPoint.y === "number"
    )
  ) {
    return defaultTargetNodeId;
  }

  const hitNodeId = getCanvasDeepLeafNodeIdAtPoint(
    editor,
    clientPoint.x,
    clientPoint.y
  );

  if (!hitNodeId) {
    return defaultTargetNodeId;
  }

  const requestedSelectionTargetNodeId =
    editor.getSelectionTargetNodeId(nodeId) || nodeId;
  const hitSelectionTargetNodeId =
    editor.getSelectionTargetNodeId(hitNodeId) || hitNodeId;

  if (hitSelectionTargetNodeId !== requestedSelectionTargetNodeId) {
    return defaultTargetNodeId;
  }

  return editor.getPathEditingEntryNodeId(hitNodeId) || hitNodeId;
};

export const openCanvasNodeEditingMode = (editor, nodeId, options = {}) => {
  if (drillIntoGroupSelection(editor, nodeId)) {
    return true;
  }

  const targetNodeId = getCanvasEditingEntryNodeId(
    editor,
    nodeId,
    options.clientPoint
  );
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
