import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import {
  createDefaultGroupNode,
  getNextGroupName,
} from "../../nodes/group/model";
import {
  createNodeMap,
  getChildIdsByParent,
  getNodeParentId,
  getSubtreeNodeIds,
  getTreeOrderedNodes,
  isContainerNode,
  isDescendantOf,
  isGroupNode,
} from "../../nodes/node-tree";

const dedupeIds = (nodeIds) => {
  return [...new Set(nodeIds.filter(Boolean))];
};

const cloneChildIdsByParent = (childIdsByParent) => {
  return new Map(
    [...childIdsByParent.entries()].map(([parentId, childIds]) => {
      return [parentId, [...childIds]];
    })
  );
};

const rebuildNodesFromMaps = (nodesById, childIdsByParent) => {
  return getTreeOrderedNodes(nodesById, childIdsByParent, ROOT_PARENT_ID);
};

const cleanupEmptyGroups = (nodes) => {
  let nextNodes = [...nodes];

  while (true) {
    const childIdsByParent = getChildIdsByParent(nextNodes);
    const emptyGroupIds = nextNodes
      .filter(
        (node) =>
          isContainerNode(node) &&
          (childIdsByParent.get(node.id) || []).length === 0
      )
      .map((node) => node.id);

    if (emptyGroupIds.length === 0) {
      return nextNodes;
    }

    const emptyGroupIdSet = new Set(emptyGroupIds);
    nextNodes = nextNodes.filter((node) => !emptyGroupIdSet.has(node.id));
  }
};

const removeNodeSubtreesWithoutCleanup = (nodes, nodeIds) => {
  const removedNodeIdSet = new Set(
    nodeIds.flatMap((nodeId) => getSubtreeNodeIds(nodes, nodeId))
  );

  return nodes.filter((node) => !removedNodeIdSet.has(node.id));
};

const removeNodeSubtrees = (nodes, nodeIds) => {
  return cleanupEmptyGroups(removeNodeSubtreesWithoutCleanup(nodes, nodeIds));
};

const getInsertedRootNodeIds = (nodes) => {
  const insertedNodeIds = new Set(nodes.map((node) => node.id));

  return nodes
    .filter((node) => !insertedNodeIds.has(node.parentId))
    .map((node) => node.id);
};

export const deleteNodeTreeState = (state, nodeIds) => {
  const nextNodes = removeNodeSubtrees(state.nodes, dedupeIds(nodeIds));
  const nextNodeIds = new Set(nextNodes.map((node) => node.id));

  return {
    focusedGroupId:
      state.focusedGroupId && nextNodeIds.has(state.focusedGroupId)
        ? state.focusedGroupId
        : null,
    nodes: nextNodes,
    selectedNodeIds: state.selectedNodeIds.filter((nodeId) =>
      nextNodeIds.has(nodeId)
    ),
  };
};

export const groupNodeTreeState = (state, nodeIds) => {
  const selectedNodeIds = dedupeIds(nodeIds).filter((nodeId) => {
    return state.nodes.some((node) => node.id === nodeId);
  });

  if (selectedNodeIds.length < 2) {
    return {};
  }

  const nodesById = createNodeMap(state.nodes);
  const firstNode = nodesById.get(selectedNodeIds[0]);
  if (!firstNode) {
    return {};
  }

  const parentId = getNodeParentId(firstNode);
  if (
    !selectedNodeIds.every((nodeId) => {
      return getNodeParentId(nodesById.get(nodeId)) === parentId;
    })
  ) {
    return {};
  }

  const childIdsByParent = cloneChildIdsByParent(
    getChildIdsByParent(state.nodes)
  );
  const siblingIds = [...(childIdsByParent.get(parentId) || [])];
  const groupNode = createDefaultGroupNode(getNextGroupName(state.nodes));
  groupNode.parentId = parentId;

  const selectedSet = new Set(selectedNodeIds);
  const firstSelectedIndex = siblingIds.findIndex((childId) =>
    selectedSet.has(childId)
  );

  if (firstSelectedIndex < 0) {
    return {};
  }

  childIdsByParent.set(
    parentId,
    siblingIds.flatMap((childId, index) => {
      if (index !== firstSelectedIndex) {
        return selectedSet.has(childId) ? [] : [childId];
      }

      return [groupNode.id];
    })
  );
  childIdsByParent.set(
    groupNode.id,
    siblingIds.filter((childId) => selectedSet.has(childId))
  );

  for (const childNodeId of selectedNodeIds) {
    const childNode = nodesById.get(childNodeId);
    if (!childNode) {
      continue;
    }

    nodesById.set(childNodeId, {
      ...childNode,
      parentId: groupNode.id,
    });
  }

  nodesById.set(groupNode.id, groupNode);

  return {
    nodes: rebuildNodesFromMaps(nodesById, childIdsByParent),
    selectedNodeIds: [groupNode.id],
  };
};

export const ungroupNodeTreeState = (state, groupNodeId) => {
  const groupNode = state.nodes.find((node) => node.id === groupNodeId);
  if (!isGroupNode(groupNode)) {
    return {};
  }

  const nodesById = createNodeMap(state.nodes);
  const childIdsByParent = cloneChildIdsByParent(
    getChildIdsByParent(state.nodes)
  );
  const parentId = getNodeParentId(groupNode);
  const groupChildIds = [...(childIdsByParent.get(groupNodeId) || [])];
  const siblingIds = [...(childIdsByParent.get(parentId) || [])];
  const groupIndex = siblingIds.indexOf(groupNodeId);

  if (groupIndex < 0) {
    return {};
  }

  childIdsByParent.set(
    parentId,
    siblingIds.flatMap((childId) => {
      return childId === groupNodeId ? groupChildIds : [childId];
    })
  );
  childIdsByParent.delete(groupNodeId);

  for (const childNodeId of groupChildIds) {
    const childNode = nodesById.get(childNodeId);
    if (!childNode) {
      continue;
    }

    nodesById.set(childNodeId, {
      ...childNode,
      parentId,
    });
  }

  nodesById.delete(groupNodeId);

  let focusedGroupId = state.focusedGroupId;

  if (state.focusedGroupId === groupNodeId) {
    focusedGroupId = parentId !== ROOT_PARENT_ID ? parentId : null;
  }

  return {
    focusedGroupId,
    nodes: rebuildNodesFromMaps(nodesById, childIdsByParent),
    selectedNodeIds: groupChildIds,
  };
};

export const moveNodeBlocksToBoundaryState = (state, nodeIds, edge) => {
  const selectedNodeIds = dedupeIds(nodeIds).filter((nodeId) => {
    return state.nodes.some((node) => node.id === nodeId);
  });

  if (selectedNodeIds.length === 0) {
    return {};
  }

  const nodesById = createNodeMap(state.nodes);
  const firstNode = nodesById.get(selectedNodeIds[0]);
  if (!firstNode) {
    return {};
  }

  const parentId = getNodeParentId(firstNode);
  if (
    !selectedNodeIds.every((nodeId) => {
      return getNodeParentId(nodesById.get(nodeId)) === parentId;
    })
  ) {
    return {};
  }

  const childIdsByParent = cloneChildIdsByParent(
    getChildIdsByParent(state.nodes)
  );
  const siblingIds = [...(childIdsByParent.get(parentId) || [])];
  const selectedNodeIdSet = new Set(selectedNodeIds);
  const selectedSiblings = siblingIds.filter((childId) =>
    selectedNodeIdSet.has(childId)
  );
  const unselectedSiblings = siblingIds.filter(
    (childId) => !selectedNodeIdSet.has(childId)
  );

  childIdsByParent.set(
    parentId,
    edge === "back"
      ? [...selectedSiblings, ...unselectedSiblings]
      : [...unselectedSiblings, ...selectedSiblings]
  );

  return {
    nodes: rebuildNodesFromMaps(nodesById, childIdsByParent),
  };
};

export const moveNodeBlocksState = (
  state,
  nodeIds,
  targetParentId = ROOT_PARENT_ID,
  beforeNodeId = null
) => {
  const movedNodeIds = dedupeIds(nodeIds).filter((nodeId) => {
    return state.nodes.some((node) => node.id === nodeId);
  });

  if (movedNodeIds.length === 0) {
    return {};
  }

  const nodesById = createNodeMap(state.nodes);
  const targetParentNode =
    targetParentId === ROOT_PARENT_ID ? null : nodesById.get(targetParentId);

  if (
    !(targetParentId === ROOT_PARENT_ID || isContainerNode(targetParentNode))
  ) {
    return {};
  }

  if (
    movedNodeIds.some((nodeId) => {
      return (
        nodeId === targetParentId ||
        (targetParentId !== ROOT_PARENT_ID &&
          isDescendantOf(state.nodes, targetParentId, nodeId))
      );
    })
  ) {
    return {};
  }

  const firstNode = nodesById.get(movedNodeIds[0]);

  if (!firstNode) {
    return {};
  }

  const sourceParentId = getNodeParentId(firstNode);

  if (
    !movedNodeIds.every((nodeId) => {
      return getNodeParentId(nodesById.get(nodeId)) === sourceParentId;
    })
  ) {
    return {};
  }

  const childIdsByParent = cloneChildIdsByParent(
    getChildIdsByParent(state.nodes)
  );
  const sourceSiblingIds = [...(childIdsByParent.get(sourceParentId) || [])];
  const movedNodeIdSet = new Set(movedNodeIds);
  const orderedMovedNodeIds = sourceSiblingIds.filter((siblingId) => {
    return movedNodeIdSet.has(siblingId);
  });

  if (orderedMovedNodeIds.length !== movedNodeIds.length) {
    return {};
  }

  const nextSourceSiblingIds = sourceSiblingIds.filter((siblingId) => {
    return !movedNodeIdSet.has(siblingId);
  });
  const targetSiblingIds = [
    ...((targetParentId === sourceParentId
      ? nextSourceSiblingIds
      : childIdsByParent.get(targetParentId)) || []),
  ];

  if (beforeNodeId && !targetSiblingIds.includes(beforeNodeId)) {
    return {};
  }

  const insertionIndex = beforeNodeId
    ? targetSiblingIds.indexOf(beforeNodeId)
    : targetSiblingIds.length;
  const nextTargetSiblingIds = [
    ...targetSiblingIds.slice(0, insertionIndex),
    ...orderedMovedNodeIds,
    ...targetSiblingIds.slice(insertionIndex),
  ];

  childIdsByParent.set(targetParentId, nextTargetSiblingIds);

  if (sourceParentId !== targetParentId) {
    childIdsByParent.set(sourceParentId, nextSourceSiblingIds);
  }

  for (const movedNodeId of orderedMovedNodeIds) {
    const movedNode = nodesById.get(movedNodeId);

    if (!movedNode) {
      continue;
    }

    nodesById.set(movedNodeId, {
      ...movedNode,
      parentId: targetParentId,
    });
  }

  const nextNodes = cleanupEmptyGroups(
    rebuildNodesFromMaps(nodesById, childIdsByParent)
  );
  const nextNodeIds = new Set(nextNodes.map((node) => node.id));

  return {
    focusedGroupId:
      state.focusedGroupId && nextNodeIds.has(state.focusedGroupId)
        ? state.focusedGroupId
        : null,
    nodes: nextNodes,
    selectedNodeIds: state.selectedNodeIds.filter((nodeId) =>
      nextNodeIds.has(nodeId)
    ),
  };
};

export const replaceNodeBlocksState = (state, nodeIds, insertedNodes) => {
  const replacedNodeIds = dedupeIds(nodeIds).filter((nodeId) => {
    return state.nodes.some((node) => node.id === nodeId);
  });

  if (!(replacedNodeIds.length > 0 && insertedNodes.length > 0)) {
    return {};
  }

  const nodesById = createNodeMap(state.nodes);
  const firstNode = nodesById.get(replacedNodeIds[0]);

  if (!firstNode) {
    return {};
  }

  const parentId = getNodeParentId(firstNode);

  if (
    !replacedNodeIds.every((nodeId) => {
      return getNodeParentId(nodesById.get(nodeId)) === parentId;
    })
  ) {
    return {};
  }

  const siblingIds = getChildIdsByParent(state.nodes).get(parentId) || [];
  const replacedNodeIdSet = new Set(replacedNodeIds);
  const orderedReplacedNodeIds = siblingIds.filter((childId) => {
    return replacedNodeIdSet.has(childId);
  });

  if (orderedReplacedNodeIds.length !== replacedNodeIds.length) {
    return {};
  }

  const beforeNodeId =
    siblingIds
      .slice(siblingIds.indexOf(orderedReplacedNodeIds.at(-1) || "") + 1)
      .find((childId) => !replacedNodeIdSet.has(childId)) || null;
  const nextNodes = removeNodeSubtreesWithoutCleanup(
    state.nodes,
    orderedReplacedNodeIds
  );
  const nextNodesById = createNodeMap(nextNodes);
  const childIdsByParent = cloneChildIdsByParent(
    getChildIdsByParent(nextNodes)
  );
  const insertedRootNodeIds = getInsertedRootNodeIds(insertedNodes);

  for (const insertedNode of insertedNodes) {
    nextNodesById.set(insertedNode.id, insertedNode);
  }

  for (const [childParentId, childIds] of getChildIdsByParent(insertedNodes)) {
    if (childParentId === parentId) {
      continue;
    }

    childIdsByParent.set(childParentId, childIds);
  }

  const remainingSiblingIds = [...(childIdsByParent.get(parentId) || [])];
  const insertionIndex = beforeNodeId
    ? remainingSiblingIds.indexOf(beforeNodeId)
    : remainingSiblingIds.length;
  const nextSiblingIds = [
    ...remainingSiblingIds.slice(0, insertionIndex),
    ...insertedRootNodeIds,
    ...remainingSiblingIds.slice(insertionIndex),
  ];

  childIdsByParent.set(parentId, nextSiblingIds);

  const rebuiltNodes = cleanupEmptyGroups(
    rebuildNodesFromMaps(nextNodesById, childIdsByParent)
  );
  const nextNodeIds = new Set(rebuiltNodes.map((node) => node.id));

  return {
    focusedGroupId:
      state.focusedGroupId && nextNodeIds.has(state.focusedGroupId)
        ? state.focusedGroupId
        : null,
    nodes: rebuiltNodes,
    selectedNodeIds: insertedRootNodeIds,
  };
};

export const setChildNodeOrderState = (state, parentId, orderedChildIds) => {
  const childIdsByParent = cloneChildIdsByParent(
    getChildIdsByParent(state.nodes)
  );
  const siblingIds = childIdsByParent.get(parentId) || [];

  if (orderedChildIds.length !== siblingIds.length) {
    return {};
  }

  if (
    orderedChildIds.some((childId) => !siblingIds.includes(childId)) ||
    siblingIds.some((childId) => !orderedChildIds.includes(childId))
  ) {
    return {};
  }

  childIdsByParent.set(parentId, [...orderedChildIds]);

  return {
    nodes: rebuildNodesFromMaps(createNodeMap(state.nodes), childIdsByParent),
  };
};

export const setRootNodeOrderState = (state, orderedRootIds) => {
  return setChildNodeOrderState(state, ROOT_PARENT_ID, orderedRootIds);
};

export const toggleNodeVisibilityTreeState = (state, nodeId) => {
  const node = state.nodes.find((currentNode) => currentNode.id === nodeId);
  if (!node) {
    return {};
  }

  return {
    nodes: state.nodes.map((currentNode) => {
      if (currentNode.id !== nodeId) {
        return currentNode;
      }

      return {
        ...currentNode,
        visible: currentNode.visible === false,
      };
    }),
  };
};
