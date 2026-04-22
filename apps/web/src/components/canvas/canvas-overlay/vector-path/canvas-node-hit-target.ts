const SVG_NS = "http://www.w3.org/2000/svg";

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

const getLocalSvgSpacePoint = (pathElement, x, y) => {
  const svgElement = pathElement.ownerSVGElement;
  const matrix = pathElement.getCTM?.();

  if (!(svgElement && matrix)) {
    return null;
  }

  const point = svgElement.createSVGPoint();
  point.x = x;
  point.y = y;

  return point.matrixTransform(matrix.inverse());
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

const isSvgPathHitInSvgSpace = (pathElement, x, y) => {
  const localPoint = getLocalSvgSpacePoint(pathElement, x, y);

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

const getSvgTransform = (node, bbox) => {
  if (!bbox) {
    return null;
  }

  const transforms: string[] = [];
  const x = node.transform.x || 0;
  const y = node.transform.y || 0;

  if (x || y) {
    transforms.push(`translate(${x} ${y})`);
  }

  const rotation = node.transform.rotation || 0;
  const scaleX = node.transform.scaleX ?? 1;
  const scaleY = node.transform.scaleY ?? 1;

  if (!(rotation || scaleX !== 1 || scaleY !== 1)) {
    return transforms.length > 0 ? transforms.join(" ") : null;
  }

  const centerX = (bbox.minX + bbox.maxX) / 2;
  const centerY = (bbox.minY + bbox.maxY) / 2;
  transforms.push(`translate(${centerX} ${centerY})`);

  if (rotation) {
    transforms.push(`rotate(${rotation})`);
  }

  if (scaleX !== 1 || scaleY !== 1) {
    transforms.push(`scale(${scaleX} ${scaleY})`);
  }

  transforms.push(`translate(${-centerX} ${-centerY})`);
  return transforms.join(" ");
};

let hitTestSvgRoot: SVGSVGElement | null = null;

const getHitTestSvgRoot = () => {
  if (typeof document === "undefined") {
    return null;
  }

  if (hitTestSvgRoot?.isConnected) {
    return hitTestSvgRoot;
  }

  const svgRoot = document.createElementNS(SVG_NS, "svg");
  svgRoot.setAttribute("aria-hidden", "true");
  svgRoot.setAttribute("width", "0");
  svgRoot.setAttribute("height", "0");
  svgRoot.style.position = "fixed";
  svgRoot.style.left = "-10000px";
  svgRoot.style.top = "-10000px";
  svgRoot.style.overflow = "visible";
  svgRoot.style.pointerEvents = "none";
  document.body.appendChild(svgRoot);
  hitTestSvgRoot = svgRoot;
  return svgRoot;
};

const isChildPathNodeHit = (editor, node, canvasPoint) => {
  const svgRoot = getHitTestSvgRoot();
  const geometry = editor.getNodeRenderGeometry(node.id);

  if (!(svgRoot && geometry?.bbox && geometry.paths.length > 0)) {
    return false;
  }

  const transform = getSvgTransform(node, geometry.bbox);
  const pathElements = geometry.paths.map((path) => {
    const pathElement = document.createElementNS(SVG_NS, "path");
    pathElement.setAttribute("d", path.d);
    pathElement.setAttribute(
      "fill",
      path.closed === false ? "none" : node.fill || "none"
    );
    pathElement.setAttribute("fill-rule", node.fillRule || "nonzero");
    pathElement.setAttribute("stroke", node.stroke || "none");
    pathElement.setAttribute("stroke-width", `${node.strokeWidth || 0}`);

    if (transform) {
      pathElement.setAttribute("transform", transform);
    }

    svgRoot.appendChild(pathElement);
    return pathElement;
  });

  const isHit = pathElements.some((pathElement) => {
    return isSvgPathHitInSvgSpace(pathElement, canvasPoint.x, canvasPoint.y);
  });

  for (const pathElement of pathElements) {
    pathElement.remove();
  }

  return isHit;
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
