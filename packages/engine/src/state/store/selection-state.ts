import { moveNodeBlocksToBoundaryState } from "./node-tree-state";

export const getSelectedNodeIds = (state, nodeIds = state.selectedNodeIds) => {
  if (!(Array.isArray(nodeIds) && nodeIds.length > 0)) {
    return [];
  }

  const availableNodeIds = new Set(state.nodes.map((node) => node.id));
  const selectedNodeIds = /** @type {string[]} */ ([]);

  for (const nodeId of nodeIds) {
    if (!(nodeId && availableNodeIds.has(nodeId))) {
      continue;
    }

    if (selectedNodeIds.includes(nodeId)) {
      continue;
    }

    selectedNodeIds.push(nodeId);
  }

  return selectedNodeIds;
};

export const moveNodesToBoundaryState = (state, nodeIds, edge) => {
  const selectedNodeIds = getSelectedNodeIds(state, nodeIds);

  if (selectedNodeIds.length === 0) {
    return {};
  }

  return moveNodeBlocksToBoundaryState(state, selectedNodeIds, edge);
};
