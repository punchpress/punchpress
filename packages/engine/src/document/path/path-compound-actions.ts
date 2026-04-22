import { finishEditingIfNeeded } from "../../editing/editing-actions";
import { createDefaultVectorNode } from "../../nodes/vector/model";
import {
  getVectorChildPathNodes,
  getVectorPathComposition,
  isBooleanPathComposition,
} from "../../nodes/vector/vector-path-composition";

const hasSameParent = (pathNodes) => {
  const firstParentId = pathNodes[0]?.parentId;

  return Boolean(
    firstParentId &&
      pathNodes.every((pathNode) => pathNode.parentId === firstParentId)
  );
};

const isVectorParent = (editor, parentId) => {
  return editor.getNode(parentId)?.type === "vector";
};

const isReleasablePathVector = (node) => {
  const pathComposition = getVectorPathComposition(node);

  return Boolean(
    node?.compoundWrapper || isBooleanPathComposition(pathComposition)
  );
};

const getCompoundablePathSelection = (
  editor,
  nodeIds = editor.selectedNodeIds
) => {
  const selectedNodes = nodeIds
    .map((nodeId) => editor.getNode(nodeId))
    .filter(Boolean);

  if (selectedNodes.length === 1 && selectedNodes[0]?.type === "vector") {
    const vectorNode = selectedNodes[0];
    const pathNodes = getVectorChildPathNodes(editor, vectorNode.id);

    return pathNodes.length >= 2 &&
      pathNodes.every((pathNode) => pathNode.closed) &&
      getVectorPathComposition(vectorNode) === "independent"
      ? pathNodes
      : null;
  }

  if (
    !(
      selectedNodes.length >= 2 &&
      selectedNodes.every((node) => node?.type === "path")
    )
  ) {
    return null;
  }

  const pathNodes = selectedNodes;

  if (
    !(
      hasSameParent(pathNodes) && pathNodes.every((pathNode) => pathNode.closed)
    )
  ) {
    return null;
  }

  const parentId = pathNodes[0].parentId;

  if (!isVectorParent(editor, parentId)) {
    return pathNodes;
  }

  const parentVectorNode = editor.getNode(parentId);
  const allChildPathNodes = getVectorChildPathNodes(editor, parentId);

  return allChildPathNodes.length === pathNodes.length &&
    getVectorPathComposition(parentVectorNode) === "independent"
    ? pathNodes
    : null;
};

const getReleasablePathSelection = (
  editor,
  nodeIds = editor.selectedNodeIds
) => {
  const selectedNodes = nodeIds
    .map((nodeId) => editor.getNode(nodeId))
    .filter(Boolean);

  if (selectedNodes.length === 1 && selectedNodes[0]?.type === "vector") {
    const vectorNode = selectedNodes[0];
    const pathNodes = getVectorChildPathNodes(editor, vectorNode.id);

    return pathNodes.length > 0 && isReleasablePathVector(vectorNode)
      ? { pathNodes, vectorNode }
      : null;
  }

  if (
    !(
      selectedNodes.length >= 1 &&
      selectedNodes.every((node) => node?.type === "path")
    )
  ) {
    return null;
  }

  const pathNodes = selectedNodes;

  if (
    !(hasSameParent(pathNodes) && isVectorParent(editor, pathNodes[0].parentId))
  ) {
    return null;
  }

  const vectorNode = editor.getNode(pathNodes[0].parentId);

  return isReleasablePathVector(vectorNode)
    ? {
        pathNodes: getVectorChildPathNodes(editor, pathNodes[0].parentId),
        vectorNode,
      }
    : null;
};

export const canMakeCompoundPath = (
  editor,
  nodeIds = editor.selectedNodeIds
) => {
  return Boolean(getCompoundablePathSelection(editor, nodeIds));
};

export const makeCompoundPath = (editor, nodeIds = editor.selectedNodeIds) => {
  const pathNodes = getCompoundablePathSelection(editor, nodeIds);

  if (pathNodes) {
    finishEditingIfNeeded(editor);

    editor.run(() => {
      if (isVectorParent(editor, pathNodes[0].parentId)) {
        editor.getState().updateNodeById(pathNodes[0].parentId, (node) => {
          if (node.type !== "vector") {
            return node;
          }

          return {
            ...node,
            pathComposition: "unite",
          };
        });

        return;
      }

      const vectorNode = createDefaultVectorNode();
      vectorNode.compoundWrapper = true;
      vectorNode.contours = [];
      vectorNode.name = "Compound";
      vectorNode.parentId = pathNodes[0].parentId;
      vectorNode.pathComposition = "unite";
      vectorNode.transform = {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
      };

      editor.getState().replaceNodeBlocks(
        pathNodes.map((pathNode) => pathNode.id),
        [
          vectorNode,
          ...pathNodes.map((pathNode) => ({
            ...pathNode,
            parentId: vectorNode.id,
          })),
        ]
      );
      editor.setSelectedNodes([vectorNode.id]);
    });

    return true;
  }

  return false;
};

export const canReleaseCompoundPath = (
  editor,
  nodeIds = editor.selectedNodeIds
) => {
  return Boolean(getReleasablePathSelection(editor, nodeIds));
};

export const releaseCompoundPath = (
  editor,
  nodeIds = editor.selectedNodeIds
) => {
  const pathSelection = getReleasablePathSelection(editor, nodeIds);

  if (pathSelection) {
    finishEditingIfNeeded(editor);

    editor.run(() => {
      if (pathSelection.vectorNode?.compoundWrapper) {
        editor.getState().replaceNodeBlocks(
          [pathSelection.vectorNode.id],
          pathSelection.pathNodes.map((pathNode) => {
            return {
              ...pathNode,
              parentId: pathSelection.vectorNode.parentId,
            };
          })
        );

        editor.setSelectedNodes(
          pathSelection.pathNodes.map((pathNode) => pathNode.id)
        );
        return;
      }

      editor.getState().updateNodeById(pathSelection.vectorNode.id, (node) => {
        if (node.type !== "vector") {
          return node;
        }

        return {
          ...node,
          compoundWrapper: false,
          pathComposition: "independent",
        };
      });
    });

    return true;
  }

  return false;
};
