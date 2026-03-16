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

  const selectedNodeIdSet = new Set(selectedNodeIds);
  const selectedNodes = state.nodes.filter((node) =>
    selectedNodeIdSet.has(node.id)
  );
  const unselectedNodes = state.nodes.filter(
    (node) => !selectedNodeIdSet.has(node.id)
  );

  return {
    nodes:
      edge === "back"
        ? [...selectedNodes, ...unselectedNodes]
        : [...unselectedNodes, ...selectedNodes],
  };
};
