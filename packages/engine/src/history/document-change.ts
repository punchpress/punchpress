// Compares field by field so fields that share a reference (contours,
// appearance) skip serialization; a moved path serializes only its transform.
const haveSameNodeValue = (beforeNode, afterNode) => {
  const keys = new Set([...Object.keys(beforeNode), ...Object.keys(afterNode)]);

  for (const key of keys) {
    const before = beforeNode[key];
    const after = afterNode[key];

    if (before !== after && JSON.stringify(before) !== JSON.stringify(after)) {
      return false;
    }
  }

  return true;
};

const orderNodesByIds = (nodes, orderedIds) => {
  if (orderedIds.length !== nodes.length) {
    return nodes;
  }

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const orderedNodes = orderedIds
    .map((nodeId) => nodesById.get(nodeId))
    .filter(Boolean);

  return orderedNodes.length === nodes.length ? orderedNodes : nodes;
};

export const createDocumentChange = (beforeNodes, afterNodes) => {
  const beforeById = new Map(beforeNodes.map((node) => [node.id, node]));
  const afterById = new Map(afterNodes.map((node) => [node.id, node]));
  const added = afterNodes.filter((node) => !beforeById.has(node.id));
  const removed = beforeNodes.filter((node) => !afterById.has(node.id));
  const updated = beforeNodes.flatMap((beforeNode) => {
    const afterNode = afterById.get(beforeNode.id);

    if (!afterNode) {
      return [];
    }

    // Writes are immutable, so an identical reference is an unchanged node;
    // distinct references still compare by value.
    if (beforeNode === afterNode || haveSameNodeValue(beforeNode, afterNode)) {
      return [];
    }

    return [
      {
        after: afterNode,
        before: beforeNode,
      },
    ];
  });
  const beforeOrder = beforeNodes.map((node) => node.id);
  const afterOrder = afterNodes.map((node) => node.id);

  if (
    added.length === 0 &&
    removed.length === 0 &&
    updated.length === 0 &&
    beforeOrder.every((nodeId, index) => nodeId === afterOrder[index])
  ) {
    return null;
  }

  return {
    added,
    afterOrder,
    beforeOrder,
    removed,
    updated,
  };
};

export const applyDocumentChange = (nodes, change, direction) => {
  const nextNodesById = new Map(nodes.map((node) => [node.id, node]));

  if (direction === "undo") {
    for (const node of change.added) {
      nextNodesById.delete(node.id);
    }

    for (const node of change.removed) {
      nextNodesById.set(node.id, node);
    }

    for (const entry of change.updated) {
      nextNodesById.set(entry.before.id, entry.before);
    }

    return orderNodesByIds([...nextNodesById.values()], change.beforeOrder);
  }

  for (const node of change.removed) {
    nextNodesById.delete(node.id);
  }

  for (const node of change.added) {
    nextNodesById.set(node.id, node);
  }

  for (const entry of change.updated) {
    nextNodesById.set(entry.after.id, entry.after);
  }

  return orderNodesByIds([...nextNodesById.values()], change.afterOrder);
};
