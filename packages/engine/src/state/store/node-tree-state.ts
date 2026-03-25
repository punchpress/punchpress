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
          isGroupNode(node) &&
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

const removeNodeSubtrees = (nodes, nodeIds) => {
  const removedNodeIdSet = new Set(
    nodeIds.flatMap((nodeId) => getSubtreeNodeIds(nodes, nodeId))
  );

  return cleanupEmptyGroups(
    nodes.filter((node) => !removedNodeIdSet.has(node.id))
  );
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
