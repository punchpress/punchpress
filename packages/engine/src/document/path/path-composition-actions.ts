import { finishEditingIfNeeded } from "../../editing/editing-actions";
import {
  getVectorChildPathNodes,
  isVectorPathComposition,
} from "../../nodes/vector/vector-path-composition";

export const setVectorPathComposition = (editor, nodeId, pathComposition) => {
  if (!isVectorPathComposition(pathComposition)) {
    return false;
  }

  const vectorNode = editor.getNode(nodeId);

  if (vectorNode?.type !== "vector") {
    return false;
  }

  if (
    pathComposition !== "independent" &&
    getVectorChildPathNodes(editor, nodeId).length < 2
  ) {
    return false;
  }

  finishEditingIfNeeded(editor);

  editor.run(() => {
    editor.getState().updateNodeById(nodeId, (node) => {
      if (node.type !== "vector") {
        return node;
      }

      return {
        ...node,
        pathComposition,
      };
    });
  });

  return true;
};
