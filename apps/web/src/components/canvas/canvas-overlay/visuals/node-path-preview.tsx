import { getNodeLocalMatrix } from "@punchpress/engine";

const IDENTITY_MATRIX = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

const multiplyMatrix = (left, right) => {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
};

const applyMatrixToPoint = (matrix, point) => {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f,
  };
};

const getTransformedBounds = (matrix, bbox) => {
  const points = [
    { x: bbox.minX, y: bbox.minY },
    { x: bbox.maxX, y: bbox.minY },
    { x: bbox.maxX, y: bbox.maxY },
    { x: bbox.minX, y: bbox.maxY },
  ].map((point) => applyMatrixToPoint(matrix, point));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    height: maxY - minY,
    left: minX,
    top: minY,
    width: maxX - minX,
  };
};

const getNodeMatrixBounds = (editor, nodeId, node, localBounds) => {
  return (
    localBounds ||
    editor.getNodeTransformBounds(nodeId) ||
    editor.getNodeRenderGeometry(node?.id)?.bbox ||
    null
  );
};

const getNodeCanvasMatrix = (editor, node, localBounds) => {
  const lineage = /** @type {Array<{ bounds: unknown; node: unknown }>} */ ([]);
  let currentNode = node;
  let currentBounds = localBounds;

  while (currentNode && currentNode.parentId !== "root") {
    lineage.push({
      bounds: getNodeMatrixBounds(
        editor,
        currentNode.id,
        currentNode,
        currentBounds
      ),
      node: currentNode,
    });
    currentNode = currentNode.parentId
      ? editor.getNode(currentNode.parentId)
      : null;
    currentBounds = null;
  }

  if (currentNode) {
    lineage.push({
      bounds: getNodeMatrixBounds(
        editor,
        currentNode.id,
        currentNode,
        currentBounds
      ),
      node: currentNode,
    });
  }

  return lineage.reverse().reduce((matrix, entry) => {
    if (!entry.bounds) {
      return matrix;
    }

    return multiplyMatrix(matrix, getNodeLocalMatrix(entry.node, entry.bounds));
  }, IDENTITY_MATRIX);
};

export const getNodeHostMatrix = (editor, node, bbox) => {
  const viewer = editor.viewerRef;

  if (!(viewer && editor.zoom > 0)) {
    return null;
  }

  const canvasMatrix = getNodeCanvasMatrix(editor, node, bbox);
  const scrollLeft = viewer.getScrollLeft();
  const scrollTop = viewer.getScrollTop();

  return {
    a: canvasMatrix.a * editor.zoom,
    b: canvasMatrix.b * editor.zoom,
    c: canvasMatrix.c * editor.zoom,
    d: canvasMatrix.d * editor.zoom,
    e: (canvasMatrix.e - scrollLeft) * editor.zoom,
    f: (canvasMatrix.f - scrollTop) * editor.zoom,
  };
};

const getRelativeMatrix = (matrix, rect) => {
  return {
    ...matrix,
    e: matrix.e - rect.left,
    f: matrix.f - rect.top,
  };
};

const formatMatrix = (matrix) => {
  return `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`;
};

export const getNodePathHostPreview = (editor, nodeId) => {
  const node = editor.getNode(nodeId);

  if (!(node && editor.isNodeEffectivelyVisible(node.id))) {
    return null;
  }

  const geometry = editor.getNodeRenderGeometry(node.id);

  if (!(geometry?.paths?.length && geometry.bbox)) {
    return null;
  }

  const matrix = getNodeHostMatrix(editor, node, geometry.bbox);

  if (!matrix) {
    return null;
  }

  const rect = getTransformedBounds(matrix, geometry.bbox);

  return {
    bbox: geometry.bbox,
    matrix: getRelativeMatrix(matrix, rect),
    nodeId,
    paths: geometry.paths,
    rect,
  };
};

export const CanvasNodePathPreview = ({ className = "", preview }) => {
  return (
    <div
      className={`canvas-hover-preview pointer-events-none absolute ${className}`}
      data-node-id={preview.nodeId}
      data-preview-kind="path"
      style={{
        height: `${Math.max(1, preview.rect.height)}px`,
        left: `${preview.rect.left}px`,
        top: `${preview.rect.top}px`,
        transformOrigin: "center center",
        width: `${Math.max(1, preview.rect.width)}px`,
      }}
    >
      <svg
        aria-hidden="true"
        className="block h-full w-full overflow-visible"
        focusable="false"
        height={Math.max(1, preview.rect.height)}
        viewBox={`0 0 ${Math.max(1, preview.rect.width)} ${Math.max(1, preview.rect.height)}`}
        width={Math.max(1, preview.rect.width)}
      >
        <g transform={formatMatrix(preview.matrix)}>
          {preview.paths.map((path) => {
            return (
              <path
                className="canvas-indicator canvas-preview"
                d={path.d}
                key={path.key || `${path.transform || "preview"}-${path.d}`}
                transform={path.transform || undefined}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
};
