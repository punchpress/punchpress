export const applyNodeUpdate = (node, updater) => {
  const mergeNodeUpdate = (nextNode) => {
    if (!(nextNode && typeof nextNode === "object")) {
      return node;
    }

    return {
      ...node,
      ...nextNode,
      transform: nextNode.transform
        ? {
            ...node.transform,
            ...nextNode.transform,
          }
        : node.transform,
    };
  };

  if (typeof updater === "function") {
    return mergeNodeUpdate(updater(node));
  }

  return mergeNodeUpdate(updater);
};

export const mapNodeById = (nodes, targetId, updater) => {
  return nodes.map((node) => {
    if (node.id !== targetId) {
      return node;
    }

    return applyNodeUpdate(node, updater);
  });
};

export const mapNodesByIds = (nodes, targetIds, updater) => {
  if (targetIds.length === 0) {
    return nodes;
  }

  const targetIdSet = new Set(targetIds);

  return nodes.map((node) => {
    if (!targetIdSet.has(node.id)) {
      return node;
    }

    return applyNodeUpdate(node, updater);
  });
};

export const orderNodesByIds = (nodes, orderedIds) => {
  if (orderedIds.length !== nodes.length) {
    return nodes;
  }

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const orderedNodes = orderedIds
    .map((nodeId) => nodesById.get(nodeId))
    .filter(Boolean);

  return orderedNodes.length === nodes.length ? orderedNodes : nodes;
};

export const withDocumentMutation = (unusedState, nextState) => {
  unusedState;
  return nextState;
};
