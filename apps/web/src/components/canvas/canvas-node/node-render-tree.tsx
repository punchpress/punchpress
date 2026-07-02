import {
  DEFAULT_VECTOR_STROKE_LINE_CAP,
  DEFAULT_VECTOR_STROKE_LINE_JOIN,
  DEFAULT_VECTOR_STROKE_MITER_LIMIT,
  format,
  getNodeLocalMatrix,
  getNodeLocalTransformBounds,
  getNodeRotation,
  getNodeScaleX,
  getNodeScaleY,
  getNodeX,
  getNodeY,
} from "@punchpress/engine";
import { CanvasRasterImage } from "../raster/canvas-raster-image";
import { getVectorPathPaintOrder } from "../vector-paint-order";

export const getCanvasNodePathFill = (path, fill) => {
  if (path.closed === false && !path.fill) {
    return "none";
  }

  return path.fill || fill || "none";
};

export const getCanvasNodePathStroke = (path, stroke) => {
  return path.stroke || stroke || "none";
};

export const getPaintVariableName = (value) => {
  if (
    typeof value !== "string" ||
    value === "none" ||
    value.startsWith("url(")
  ) {
    return null;
  }

  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) % 2_147_483_647;
  }

  return `--pp-paint-${Math.abs(hash).toString(36)}`;
};

export const getCanvasPaintValue = (value) => {
  const variableName = getPaintVariableName(value);

  return variableName ? `var(${variableName}, ${value})` : value;
};

export const getPaintPreviewStyle = (preview) => {
  const variableName = getPaintVariableName(preview?.baseValue);

  return variableName ? { [variableName]: preview.value } : undefined;
};

export const getNodeOpacity = (node) => {
  return typeof node?.opacity === "number" ? node.opacity : 1;
};

export const getSvgNodeAncestorOpacityChain = (editor, nodeId) => {
  let opacity = 1;
  let currentNode = editor.getNode(nodeId);

  while (currentNode?.parentId) {
    currentNode = editor.getNode(currentNode.parentId);

    if (!currentNode) {
      break;
    }

    opacity *= getNodeOpacity(currentNode);
  }

  return opacity;
};

export const getNodeRenderPaths = (editor, node, paths) => {
  const inheritedOpacity = getSvgNodeAncestorOpacityChain(editor, node.id);
  const nodeOpacity = getNodeOpacity(node);
  const shouldNormalizeNodeOpacity =
    node.type === "path" ||
    (node.type === "vector" && editor.getChildNodeIds(node.id).length === 0);

  return paths.map((path) => ({
    ...path,
    opacity:
      path.opacity == null
        ? undefined
        : (shouldNormalizeNodeOpacity && nodeOpacity
            ? path.opacity / nodeOpacity
            : path.opacity) * inheritedOpacity,
  }));
};

export const getSvgNodeTransformBounds = (editor, node) => {
  return getNodeLocalTransformBounds(editor, node.id);
};

export const getSvgNodeTransform = (node, bbox) => {
  const x = getNodeX(node) || 0;
  const y = getNodeY(node) || 0;
  const rotation = getNodeRotation(node) || 0;
  const scaleX = getNodeScaleX(node) ?? 1;
  const scaleY = getNodeScaleY(node) ?? 1;

  if (!(bbox && (x || y || rotation || scaleX !== 1 || scaleY !== 1))) {
    return null;
  }

  const matrix = getNodeLocalMatrix(node, bbox);

  return `matrix(${format(matrix.a)} ${format(matrix.b)} ${format(matrix.c)} ${format(matrix.d)} ${format(matrix.e)} ${format(matrix.f)})`;
};

export const getSvgNodeTransformChain = (
  editor,
  rootNodeId,
  descendantNodeId
) => {
  const nodes: unknown[] = [];
  let currentNode = editor.getNode(descendantNodeId);

  while (currentNode && currentNode.id !== rootNodeId) {
    nodes.push(currentNode);
    currentNode = currentNode.parentId
      ? editor.getNode(currentNode.parentId)
      : null;
  }

  return nodes
    .reverse()
    .map((node) =>
      getSvgNodeTransform(node, getSvgNodeTransformBounds(editor, node))
    )
    .filter(Boolean)
    .join(" ");
};

export const getGroupNodePaths = (editor, nodeId) => {
  return editor.getDescendantLeafNodeIds(nodeId).flatMap((descendantNodeId) => {
    const descendantNode = editor.getNode(descendantNodeId);
    const geometry = editor.getNodeRenderGeometry(descendantNodeId);

    if (
      !(
        descendantNode &&
        editor.isNodeEffectivelyVisible(descendantNodeId) &&
        geometry?.paths?.length > 0
      )
    ) {
      return [];
    }

    const nodeTransform = getSvgNodeTransformChain(
      editor,
      nodeId,
      descendantNode.id
    );

    return geometry.paths.map((path, index) => ({
      ...path,
      key: `${descendantNodeId}-${path.key || index}`,
      opacity:
        (path.opacity ?? getNodeOpacity(descendantNode)) *
        getSvgNodeAncestorOpacityChain(editor, descendantNode.id),
      sourceNodeId: descendantNode.id,
      transform: [nodeTransform, path.transform].filter(Boolean).join(" "),
    }));
  });
};

export const getGroupNodeRenderTree = (
  editor,
  rootNodeId,
  parentNodeId = rootNodeId
) => {
  return editor.getChildNodeIds(parentNodeId).flatMap((childNodeId) => {
    const childNode = editor.getNode(childNodeId);

    if (!(childNode && editor.isNodeEffectivelyVisible(childNodeId))) {
      return [];
    }

    if (childNode.type === "group") {
      return [
        {
          children: getGroupNodeRenderTree(editor, rootNodeId, childNode.id),
          key: childNode.id,
          opacity: getNodeOpacity(childNode),
          transform: getSvgNodeTransform(
            childNode,
            getSvgNodeTransformBounds(editor, childNode)
          ),
          type: "group",
        },
      ];
    }

    const geometry = editor.getNodeRenderGeometry(childNode.id);

    if (childNode.type === "image" && geometry?.bbox) {
      return [
        {
          baseHeight: childNode.baseHeight,
          baseWidth: childNode.baseWidth,
          baseX: childNode.baseX,
          baseY: childNode.baseY,
          height: childNode.height,
          key: childNode.id,
          nodeId: childNode.id,
          opacity: getNodeOpacity(childNode),
          src: childNode.src,
          tileSources: childNode.tileSources,
          transform: getSvgNodeTransform(childNode, geometry.bbox),
          type: "image",
          width: childNode.width,
        },
      ];
    }

    if (!geometry?.paths?.length) {
      return [];
    }

    const nodeTransform = getSvgNodeTransform(childNode, geometry.bbox);
    const childNodeOpacity = getNodeOpacity(childNode);
    const shouldApplyContainerOpacity =
      childNode.type === "vector" &&
      editor.getChildNodeIds(childNode.id).length > 0;

    return geometry.paths.map((path, index) => ({
      ...path,
      key: `${childNode.id}-${path.key || index}`,
      opacity: shouldApplyContainerOpacity
        ? (path.opacity ?? 1) * childNodeOpacity
        : (path.opacity ?? childNodeOpacity),
      sourceNodeId: childNode.id,
      transform: [nodeTransform, path.transform].filter(Boolean).join(" "),
      type: "path",
    }));
  });
};

export const getGroupNodeArtState = (editor, state, nodeId) => {
  const frame = editor.getNodeRenderFrame(nodeId);
  const node = editor.getNode(nodeId);

  if (!(frame?.bounds && node)) {
    return null;
  }

  return {
    bbox: frame.bounds,
    fill: null,
    fillRule: undefined,
    isEditing: state.editingNodeId === nodeId,
    isInteractionProxy: false,
    opacity: getNodeOpacity(node),
    paths: getGroupNodePaths(editor, nodeId),
    ready: true,
    renderMode: "paths",
    renderTree: getGroupNodeRenderTree(editor, nodeId),
    stroke: null,
    strokeLineCap: DEFAULT_VECTOR_STROKE_LINE_CAP,
    strokeLineJoin: DEFAULT_VECTOR_STROKE_LINE_JOIN,
    strokeMiterLimit: DEFAULT_VECTOR_STROKE_MITER_LIMIT,
    strokeWidth: 0,
  };
};

export const CanvasNodePath = ({
  fill,
  fillRule,
  isEditing,
  path,
  stroke,
  strokeLineCap,
  strokeLineJoin,
  strokeMiterLimit,
  strokeWidth,
}) => {
  const fillValue = getCanvasNodePathFill(path, fill);
  const strokeValue = getCanvasNodePathStroke(path, stroke);

  return (
    <path
      d={path.d}
      fill={fillValue}
      fillRule={path.fillRule || fillRule}
      key={path.key || `${path.transform || "shape"}-${path.d}`}
      opacity={isEditing ? 0 : (path.opacity ?? 1)}
      paintOrder={getVectorPathPaintOrder()}
      pointerEvents="none"
      stroke={strokeValue}
      strokeLinecap={path.strokeLineCap || strokeLineCap}
      strokeLinejoin={path.strokeLineJoin || strokeLineJoin}
      strokeMiterlimit={path.strokeMiterLimit ?? strokeMiterLimit}
      strokeWidth={path.strokeWidth ?? strokeWidth}
      style={{
        fill: getCanvasPaintValue(fillValue),
        stroke: getCanvasPaintValue(strokeValue),
      }}
      transform={path.transform || undefined}
    />
  );
};

export const CanvasNodeRenderTree = ({
  fill,
  fillRule,
  isEditing,
  items,
  stroke,
  strokeLineCap,
  strokeLineJoin,
  strokeMiterLimit,
  strokeWidth,
}) => {
  return items.map((item) => {
    if (item.type === "group") {
      return (
        <g
          key={item.key}
          opacity={item.opacity ?? 1}
          transform={item.transform || undefined}
        >
          <CanvasNodeRenderTree
            fill={fill}
            fillRule={fillRule}
            isEditing={isEditing}
            items={item.children || []}
            stroke={stroke}
            strokeLineCap={strokeLineCap}
            strokeLineJoin={strokeLineJoin}
            strokeMiterLimit={strokeMiterLimit}
            strokeWidth={strokeWidth}
          />
        </g>
      );
    }

    if (item.type === "image") {
      return (
        <CanvasRasterImage
          baseHeight={item.baseHeight}
          baseWidth={item.baseWidth}
          baseX={item.baseX}
          baseY={item.baseY}
          height={item.height}
          key={item.key}
          nodeId={item.nodeId}
          opacity={isEditing ? 0 : (item.opacity ?? 1)}
          src={item.src}
          tileSources={item.tileSources}
          transform={item.transform || undefined}
          width={item.width}
        />
      );
    }

    return (
      <CanvasNodePath
        fill={fill}
        fillRule={fillRule}
        isEditing={isEditing}
        key={item.key || `${item.transform || "shape"}-${item.d}`}
        path={item}
        stroke={stroke}
        strokeLineCap={strokeLineCap}
        strokeLineJoin={strokeLineJoin}
        strokeMiterLimit={strokeMiterLimit}
        strokeWidth={strokeWidth}
      />
    );
  });
};
