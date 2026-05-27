const getCanvasNodeElementsAtPoint = (clientX, clientY) => {
  if (typeof document === "undefined") {
    return [];
  }

  const seenNodeIds = new Set();

  return document.elementsFromPoint(clientX, clientY).flatMap((element) => {
    const nodeElement =
      element instanceof Element
        ? element.closest(".canvas-node[data-node-id]")
        : null;
    const nodeId =
      nodeElement instanceof HTMLElement ? nodeElement.dataset.nodeId : null;

    if (!(nodeElement instanceof HTMLElement && nodeId)) {
      return [];
    }

    if (seenNodeIds.has(nodeId)) {
      return [];
    }

    seenNodeIds.add(nodeId);
    return [nodeElement];
  });
};

const getCanvasPoint = (editor, clientX, clientY) => {
  const viewer = editor.viewerRef;
  const host = editor.hostRef;

  if (!(viewer && host)) {
    return null;
  }

  const rect = host.getBoundingClientRect();

  return {
    x: viewer.getScrollLeft() + (clientX - rect.left) / editor.zoom,
    y: viewer.getScrollTop() + (clientY - rect.top) / editor.zoom,
  };
};

const isCanvasNodeHit = (editor, nodeId, canvasPoint) => {
  return editor.hitTestNodePoint(nodeId, canvasPoint);
};

const isChildPathNodeHit = (editor, node, canvasPoint) => {
  return editor.hitTestNodePoint(node.id, canvasPoint);
};

const getVectorChildPathNodeIdAtPoint = (editor, nodeId, canvasPoint) => {
  const childPathNodes = editor
    .getChildNodeIds(nodeId)
    .map((childNodeId) => editor.getNode(childNodeId))
    .filter((childNode) => childNode?.type === "path")
    .reverse();

  for (const childPathNode of childPathNodes) {
    if (isChildPathNodeHit(editor, childPathNode, canvasPoint)) {
      return childPathNode.id;
    }
  }

  return null;
};

const getDescendantLeafNodeIdAtPoint = (editor, nodeId, canvasPoint) => {
  const descendantLeafNodeIds = editor
    .getDescendantLeafNodeIds(nodeId)
    .reverse();

  for (const descendantNodeId of descendantLeafNodeIds) {
    if (
      editor.isNodeEffectivelyVisible(descendantNodeId) &&
      editor.hitTestNodePoint(descendantNodeId, canvasPoint)
    ) {
      return descendantNodeId;
    }
  }

  return null;
};

export const getCanvasVectorChildPathNodeIdAtPoint = (
  editor,
  nodeId,
  clientX,
  clientY
) => {
  const canvasPoint = getCanvasPoint(editor, clientX, clientY);

  return canvasPoint
    ? getVectorChildPathNodeIdAtPoint(editor, nodeId, canvasPoint)
    : null;
};

export const getCanvasLeafNodeIdAtPoint = (editor, clientX, clientY) => {
  const canvasPoint = getCanvasPoint(editor, clientX, clientY);

  if (!canvasPoint) {
    return null;
  }

  for (const nodeElement of getCanvasNodeElementsAtPoint(clientX, clientY)) {
    const nodeId = nodeElement.dataset.nodeId;

    if (!(nodeId && isCanvasNodeHit(editor, nodeId, canvasPoint))) {
      continue;
    }

    return nodeId;
  }

  return null;
};

export const getCanvasDeepLeafNodeIdAtPoint = (editor, clientX, clientY) => {
  const canvasPoint = getCanvasPoint(editor, clientX, clientY);

  if (!canvasPoint) {
    return null;
  }

  for (const nodeElement of getCanvasNodeElementsAtPoint(clientX, clientY)) {
    const nodeId = nodeElement.dataset.nodeId;
    const node = nodeId ? editor.getNode(nodeId) : null;

    if (node?.type === "group" || node?.type === "vector") {
      const childPathNodeId = getDescendantLeafNodeIdAtPoint(
        editor,
        nodeId,
        canvasPoint
      );

      if (childPathNodeId) {
        return childPathNodeId;
      }

      if (nodeId && isCanvasNodeHit(editor, nodeId, canvasPoint)) {
        return nodeId;
      }
    }

    if (nodeId && isCanvasNodeHit(editor, nodeId, canvasPoint)) {
      return nodeId;
    }
  }

  return null;
};
