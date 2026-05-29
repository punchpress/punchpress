import { drillIntoGroupSelection } from "./canvas-group-drill-in";
import {
  getCanvasDeepLeafNodeIdAtPoint,
  getCanvasVectorChildPathNodeIdAtPoint,
} from "./canvas-overlay/vector-path/canvas-node-hit-target";

const focusNearestGroupAncestor = (editor, nodeId) => {
  let currentNode = editor.getNode(nodeId);

  while (currentNode?.parentId) {
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
  const requestedNode = editor.getNode(nodeId);
  const vectorChildHitNodeId =
    requestedNode?.type === "vector"
      ? getCanvasVectorChildPathNodeIdAtPoint(
          editor,
          nodeId,
          clientPoint.x,
          clientPoint.y
        )
      : null;
  const targetHitNodeId = vectorChildHitNodeId || hitNodeId;

  if (!targetHitNodeId) {
    return defaultTargetNodeId;
  }

  const requestedSelectionTargetNodeId =
    editor.getSelectionTargetNodeId(nodeId) || nodeId;
  const hitSelectionTargetNodeId =
    editor.getSelectionTargetNodeId(targetHitNodeId) || targetHitNodeId;

  if (hitSelectionTargetNodeId !== requestedSelectionTargetNodeId) {
    return defaultTargetNodeId;
  }

  return editor.getPathEditingEntryNodeId(targetHitNodeId) || targetHitNodeId;
};

export const openCanvasNodeEditingMode = (editor, nodeId, options = {}) => {
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

  if (nodeEditCapabilities.requiresPathEditing) {
    focusNearestGroupAncestor(editor, node.id);
    const didStart = editor.startPathEditing(node.id);

    if (didStart) {
      editor.setActiveTool("node");
    }

    return didStart;
  }

  if (drillIntoGroupSelection(editor, nodeId)) {
    return true;
  }

  if (nodeEditCapabilities.canEditText) {
    editor.startEditing(node);
    return true;
  }

  return false;
};
