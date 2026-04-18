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

const getLocalSvgPoint = (pathElement, clientX, clientY) => {
  const svgElement = pathElement.ownerSVGElement;
  const screenMatrix =
    pathElement.getScreenCTM?.() || svgElement?.getScreenCTM?.();

  if (!(svgElement && screenMatrix)) {
    return null;
  }

  const point = svgElement.createSVGPoint();
  point.x = clientX;
  point.y = clientY;

  return point.matrixTransform(screenMatrix.inverse());
};

const isSvgPathHit = (pathElement, clientX, clientY) => {
  const localPoint = getLocalSvgPoint(pathElement, clientX, clientY);

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
