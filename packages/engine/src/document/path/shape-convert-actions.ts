import { createPathNodeFromShape } from "../../nodes/shape/shape-engine";
import { finishEditingIfNeeded } from "../../editing/editing-actions";

const getConvertibleShapeNode = (editor, nodeId) => {
  const node = nodeId ? editor.getNode(nodeId) : null;

  return node?.type === "shape" ? node : null;
};

export const canConvertShapeToPath = (editor, nodeId) => {
  const node = getConvertibleShapeNode(editor, nodeId);

  return Boolean(node && createPathNodeFromShape(node));
};

export const convertShapeToPath = (editor, nodeId = editor.selectedNodeId) => {
  if (!canConvertShapeToPath(editor, nodeId)) {
    return false;
  }

  finishEditingIfNeeded(editor);
  editor.stopPathEditing();

  const node = getConvertibleShapeNode(editor, nodeId);
  const pathNode = node ? createPathNodeFromShape(node) : null;

  if (!pathNode) {
    return false;
  }

  editor.run(() => {
    editor.getState().replaceNodeBlocks([nodeId], [pathNode]);
    editor.setSelectedNodes([pathNode.id]);
  });

  return true;
};
