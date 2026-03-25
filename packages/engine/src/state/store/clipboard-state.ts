import {
  PUNCH_CLIPBOARD_MIME_TYPE,
  PUNCH_DOCUMENT_VERSION,
  ROOT_PARENT_ID,
} from "@punchpress/punch-schema";
import {
  createNodeMap,
  getAncestorNodeIds,
  getChildIdsByParent,
  getNodeParentId,
  getSubtreeNodeIds,
  getTreeOrderedNodes,
} from "../../nodes/node-tree";
import { createDefaultNode, createId } from "../../nodes/text/model";
import { getSelectedNodeIds } from "./selection-state";

const getClipboardRootNodeIds = (nodes, nodeIds) => {
  const selectedNodeIdSet = new Set(nodeIds);

  return nodeIds.filter((nodeId) => {
    return !getAncestorNodeIds(nodes, nodeId).some((ancestorId) => {
      return selectedNodeIdSet.has(ancestorId);
    });
  });
};

export const createClipboardContentState = (state, nodeIds) => {
  const selectedNodeIds = getSelectedNodeIds(state, nodeIds);

  if (selectedNodeIds.length === 0) {
    return null;
  }

  const rootNodeIds = getClipboardRootNodeIds(state.nodes, selectedNodeIds);
  const copiedNodeIds = new Set(
    rootNodeIds.flatMap((nodeId) => getSubtreeNodeIds(state.nodes, nodeId))
  );

  return {
    documentVersion: PUNCH_DOCUMENT_VERSION,
    nodes: state.nodes.filter((node) => copiedNodeIds.has(node.id)),
    rootNodeIds,
    type: PUNCH_CLIPBOARD_MIME_TYPE,
    version: 1,
  };
};

const cloneClipboardContentState = (
  content,
  { offset = { x: 0, y: 0 }, preserveRootParents = false } = {}
) => {
  if (!(content?.nodes?.length && content?.rootNodeIds?.length)) {
    return null;
  }

  const idMap = new Map(content.nodes.map((node) => [node.id, createId()]));
  const rootNodeIdSet = new Set(content.rootNodeIds);
  const selectedNodeIds = content.rootNodeIds
    .map((nodeId) => idMap.get(nodeId))
    .filter(Boolean);
  const nodes = content.nodes.map((node) => {
    const isRootNode = rootNodeIdSet.has(node.id);
    const mappedParentId = idMap.get(node.parentId);
    let parentId = mappedParentId || ROOT_PARENT_ID;

    if (isRootNode) {
      parentId = preserveRootParents ? getNodeParentId(node) : ROOT_PARENT_ID;
    }

    return {
      ...node,
      id: idMap.get(node.id),
      parentId,
      transform: node.transform
        ? {
            ...node.transform,
            x: node.transform.x + offset.x,
            y: node.transform.y + offset.y,
          }
        : node.transform,
    };
  });

  return {
    nodes,
    selectedNodeIds,
    sourceRootNodeIds: content.rootNodeIds,
  };
};

const insertNodesAfterSourceRoots = (
  stateNodes,
  nodes,
  sourceRootNodeIds,
  selectedNodeIds
) => {
  const nextNodes = [...stateNodes, ...nodes];
  const nodesById = createNodeMap(nextNodes);
  const childIdsByParent = getChildIdsByParent(nextNodes);

  selectedNodeIds.forEach((selectedNodeId, index) => {
    const sourceRootNodeId = sourceRootNodeIds[index];
    const sourceNode = nodesById.get(sourceRootNodeId);

    if (!sourceNode) {
      return;
    }

    const parentId = getNodeParentId(sourceNode);
    const siblingIds = (childIdsByParent.get(parentId) || []).filter(
      (nodeId) => {
        return nodeId !== selectedNodeId;
      }
    );
    const sourceIndex = siblingIds.indexOf(sourceRootNodeId);

    if (sourceIndex === -1) {
      return;
    }

    siblingIds.splice(sourceIndex + 1, 0, selectedNodeId);
    childIdsByParent.set(parentId, siblingIds);
  });

  return getTreeOrderedNodes(nodesById, childIdsByParent);
};

export const insertClipboardContentState = (
  state,
  content,
  {
    insertAfterSourceRoots = false,
    offset = { x: 0, y: 0 },
    preserveRootParents = false,
  } = {}
) => {
  const clonedContent = cloneClipboardContentState(content, {
    offset,
    preserveRootParents,
  });

  if (!clonedContent) {
    return {};
  }

  return {
    nodes: insertAfterSourceRoots
      ? insertNodesAfterSourceRoots(
          state.nodes,
          clonedContent.nodes,
          clonedContent.sourceRootNodeIds,
          clonedContent.selectedNodeIds
        )
      : [...state.nodes, ...clonedContent.nodes],
    selectedNodeIds: clonedContent.selectedNodeIds,
  };
};

export const pasteClipboardContentState = (
  state,
  content,
  { offset = { x: 0, y: 0 } } = {}
) => {
  return insertClipboardContentState(state, content, { offset });
};

export const pasteTextState = (state, text, font, point) => {
  if (typeof text !== "string" || text.length === 0) {
    return {};
  }

  const node = createDefaultNode(font);
  node.text = text;

  if (point) {
    node.transform = {
      ...node.transform,
      x: point.x,
      y: point.y,
    };
  }

  return {
    activeTool: "pointer",
    editingNodeId: null,
    editingOriginalText: "",
    editingText: "",
    focusedGroupId: null,
    nodes: [...state.nodes, node],
    pathEditingNodeId: null,
    selectedNodeIds: [node.id],
  };
};
