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

const getLocalSvgPoint = (pathElement, x, y) => {
  const svgElement = pathElement.ownerSVGElement;
  const screenMatrix =
    pathElement.getScreenCTM?.() || svgElement?.getScreenCTM?.();

  if (!(svgElement && screenMatrix)) {
    return null;
  }

  const point = svgElement.createSVGPoint();
  point.x = x;
  point.y = y;

  return point.matrixTransform(screenMatrix.inverse());
};

const isSvgPathHit = (pathElement, x, y) => {
  const localPoint = getLocalSvgPoint(pathElement, x, y);

  if (!localPoint) {
    return false;
  }

  const fill = pathElement.getAttribute("fill");
  const stroke = pathElement.getAttribute("stroke");
  const strokeWidth = Number(pathElement.getAttribute("stroke-width") || 0);
  const canHitFill = Boolean(fill && fill !== "none");
  const canHitStroke = Boolean(stroke && stroke !== "none" && strokeWidth > 0);

  return Boolean(
    (canHitFill && pathElement.isPointInFill(localPoint)) ||
      (canHitStroke && pathElement.isPointInStroke?.(localPoint))
  );
};

const isCanvasNodeHit = (nodeElement, clientX, clientY) => {
  return [...nodeElement.querySelectorAll("path")].some((pathElement) => {
    return (
      pathElement instanceof SVGGeometryElement &&
      isSvgPathHit(pathElement, clientX, clientY)
    );
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

export const getCanvasLeafNodeIdAtPoint = (clientX, clientY) => {
  for (const nodeElement of getCanvasNodeElementsAtPoint(clientX, clientY)) {
    const nodeId = nodeElement.dataset.nodeId;

    if (!(nodeId && isCanvasNodeHit(nodeElement, clientX, clientY))) {
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

    if (!(nodeId && isCanvasNodeHit(nodeElement, clientX, clientY))) {
      if (nodeId && editor.getNode(nodeId)?.type === "text") {
        return nodeId;
      }

      continue;
    }

    const node = editor.getNode(nodeId);

    if (node?.type !== "vector") {
      return nodeId;
    }

    return (
      getVectorChildPathNodeIdAtPoint(editor, nodeId, canvasPoint) || nodeId
    );
  }

  return null;
};
