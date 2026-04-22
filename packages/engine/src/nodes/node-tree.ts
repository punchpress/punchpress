import { ROOT_PARENT_ID } from "@punchpress/punch-schema";

export const isGroupNode = (node) => {
  return node?.type === "group";
};

export const isTextNode = (node) => {
  return node?.type === "text";
};

export const isShapeNode = (node) => {
  return node?.type === "shape";
};

export const isVectorNode = (node) => {
  return node?.type === "vector";
};

export const isPathNode = (node) => {
  return node?.type === "path";
};

const hasEditableVectorContours = (node) => {
  return (
    isVectorNode(node) &&
    Array.isArray(node.contours) &&
    node.contours.length > 0
  );
};

export const isContainerNode = (node) => {
  return isGroupNode(node) || isVectorNode(node);
};

export const getNodeParentId = (node) => {
  return node?.parentId || ROOT_PARENT_ID;
};

export const createNodeMap = (nodes) => {
  return new Map(nodes.map((node) => [node.id, node]));
};

export const getChildIdsByParent = (nodes) => {
  const childIdsByParent = new Map();

  for (const node of nodes) {
    const parentId = getNodeParentId(node);
    const childIds = childIdsByParent.get(parentId) || [];
    childIds.push(node.id);
    childIdsByParent.set(parentId, childIds);
  }

  return childIdsByParent;
};

export const getChildNodeIds = (nodes, parentId = ROOT_PARENT_ID) => {
  return nodes
    .filter((node) => getNodeParentId(node) === parentId)
    .map((node) => node.id);
};

export const getChildNodes = (nodes, parentId = ROOT_PARENT_ID) => {
  return nodes.filter((node) => getNodeParentId(node) === parentId);
};

export const getAncestorNodeIds = (nodes, nodeId) => {
  const nodesById = createNodeMap(nodes);
  const ancestorIds: string[] = [];
  let currentNode = nodesById.get(nodeId) || null;

  while (currentNode && getNodeParentId(currentNode) !== ROOT_PARENT_ID) {
    const parentNode = nodesById.get(getNodeParentId(currentNode)) || null;
    if (!parentNode) {
      break;
    }

    ancestorIds.push(parentNode.id);
    currentNode = parentNode;
  }

  return ancestorIds;
};

export const isDescendantOf = (nodes, nodeId, ancestorId) => {
  if (!(nodeId && ancestorId) || nodeId === ancestorId) {
    return nodeId === ancestorId;
  }

  return getAncestorNodeIds(nodes, nodeId).includes(ancestorId);
};

export const getTreeScopeParentId = (focusedGroupId) => {
  return focusedGroupId || ROOT_PARENT_ID;
};

const getRootAncestorId = (nodesById, node) => {
  let currentNode = node;

  while (currentNode && getNodeParentId(currentNode) !== ROOT_PARENT_ID) {
    const parentNode = nodesById.get(getNodeParentId(currentNode)) || null;

    if (!parentNode) {
      break;
    }

    currentNode = parentNode;
  }

  return currentNode?.id || node?.id || null;
};

export const getSelectionTargetNodeId = (nodes, nodeId, focusedGroupId) => {
  if (!nodeId) {
    return null;
  }

  const nodesById = createNodeMap(nodes);
  const targetNode = nodesById.get(nodeId) || null;

  if (!targetNode) {
    return null;
  }

  const scopeParentId = getTreeScopeParentId(focusedGroupId);
  const isInsideFocusedGroup = focusedGroupId
    ? nodeId === focusedGroupId || isDescendantOf(nodes, nodeId, focusedGroupId)
    : false;

  let currentNode = targetNode;

  if (focusedGroupId && !isInsideFocusedGroup) {
    return getRootAncestorId(nodesById, currentNode) || targetNode.id;
  }

  while (currentNode && getNodeParentId(currentNode) !== scopeParentId) {
    const parentNode = nodesById.get(getNodeParentId(currentNode)) || null;
    if (!parentNode) {
      break;
    }

    currentNode = parentNode;
  }

  return currentNode?.id || targetNode.id;
};

export const getSubtreeNodeIds = (nodes, nodeId) => {
  const childIdsByParent = getChildIdsByParent(nodes);
  const subtreeNodeIds: string[] = [];

  const visit = (currentNodeId) => {
    subtreeNodeIds.push(currentNodeId);

    for (const childNodeId of childIdsByParent.get(currentNodeId) || []) {
      visit(childNodeId);
    }
  };

  visit(nodeId);

  return subtreeNodeIds;
};

export const getDescendantLeafNodeIds = (nodes, nodeId) => {
  const nodesById = createNodeMap(nodes);
  const descendantLeafNodeIds: string[] = [];

  for (const currentNodeId of getSubtreeNodeIds(nodes, nodeId)) {
    if (currentNodeId === nodeId) {
      continue;
    }

    const node = nodesById.get(currentNodeId);
    if (node && !isContainerNode(node)) {
      descendantLeafNodeIds.push(currentNodeId);
    }
  }

  return descendantLeafNodeIds;
};

export const getEffectiveSelectionNodeIds = (nodes, nodeIds) => {
  const nodesById = createNodeMap(nodes);
  const effectiveNodeIds: string[] = [];

  for (const nodeId of nodeIds) {
    const node = nodesById.get(nodeId);
    if (!node) {
      continue;
    }

    if (!isContainerNode(node)) {
      effectiveNodeIds.push(nodeId);
      continue;
    }

    if (hasEditableVectorContours(node)) {
      effectiveNodeIds.push(nodeId);
      continue;
    }

    effectiveNodeIds.push(...getDescendantLeafNodeIds(nodes, nodeId));
  }

  return [...new Set(effectiveNodeIds)];
};

export const getTreeOrderedNodes = (
  nodesById,
  childIdsByParent,
  parentId = ROOT_PARENT_ID
) => {
  const orderedNodes: NonNullable<ReturnType<typeof nodesById.get>>[] = [];

  for (const childId of childIdsByParent.get(parentId) || []) {
    const node = nodesById.get(childId);
    if (!node) {
      continue;
    }

    orderedNodes.push(node);
    orderedNodes.push(
      ...getTreeOrderedNodes(nodesById, childIdsByParent, childId)
    );
  }

  return orderedNodes;
};

export const rebuildTreeOrder = (nodes) => {
  return getTreeOrderedNodes(createNodeMap(nodes), getChildIdsByParent(nodes));
};
