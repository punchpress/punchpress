import {
  buildAppearanceObjects,
  format,
  getNodeAppearance,
  getNodeLocalMatrix,
  getNodeLocalTransformBounds,
  getNodeRotation,
  getNodeScaleX,
  getNodeScaleY,
  getNodeX,
  getNodeY,
  getPrimaryPaint,
} from "@punchpress/engine";
import { parseColor } from "@punchpress/punch-schema";
import { CanvasRasterImage } from "../raster/canvas-raster-image";
import { CanvasAppearanceObjects } from "./canvas-appearance-objects";
import { CanvasFallbackText } from "./canvas-fallback-text";

const getPaintVariableName = (value) => {
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

// Paint draws key their variable by canonical color, so the preview's base and
// target colors are canonicalized the same way (alpha stays on the layer).
export const getPaintPreviewStyle = (preview) => {
  const baseColor = parseColor(preview?.baseValue)?.color ?? preview?.baseValue;
  const variableName = getPaintVariableName(baseColor);

  return variableName
    ? { [variableName]: parseColor(preview.value)?.color ?? preview.value }
    : undefined;
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

const getSvgNodeTransformBounds = (editor, node) => {
  return getNodeLocalTransformBounds(editor, node.id);
};

const getSvgNodeTransform = (node, bbox) => {
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

    const fallbackText = editor.getTextFallbackPreview(childNode, geometry);
    if (fallbackText) {
      return [
        {
          ...fallbackText,
          ...getPrimaryPaint(getNodeAppearance(childNode)),
          key: childNode.id,
          opacity: getNodeOpacity(childNode),
          transform: getSvgNodeTransform(childNode, geometry?.bbox),
          type: "fallback-text",
        },
      ];
    }

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
          transform: getSvgNodeTransform(childNode, geometry.bbox),
          type: "image",
          width: childNode.width,
        },
      ];
    }

    if (!geometry?.paths?.length) {
      return [];
    }

    return [
      {
        key: childNode.id,
        objects: buildAppearanceObjects(childNode, geometry.paths, (id) =>
          editor.getNode(id)
        ),
        opacity: getNodeOpacity(childNode),
        transform: getSvgNodeTransform(childNode, geometry.bbox),
        type: "objects",
      },
    ];
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
    fallbackPaint: null,
    fallbackText: null,
    image: null,
    isEditing: state.editingNodeId === nodeId,
    isInteractionProxy: false,
    objects: [],
    opacity:
      getNodeOpacity(node) * getSvgNodeAncestorOpacityChain(editor, nodeId),
    ready: true,
    renderTree: getGroupNodeRenderTree(editor, nodeId),
  };
};

export const CanvasNodeRenderTree = ({
  isEditing,
  items,
  renderRootNodeId,
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
            isEditing={isEditing}
            items={item.children || []}
            renderRootNodeId={renderRootNodeId}
          />
        </g>
      );
    }

    if (item.type === "image") {
      return (
        <g key={item.key} transform={item.transform || undefined}>
          <svg
            aria-hidden="true"
            height={item.height}
            overflow="hidden"
            width={item.width}
            x={0}
            y={0}
          >
            <CanvasRasterImage
              baseHeight={item.baseHeight}
              baseWidth={item.baseWidth}
              baseX={item.baseX}
              baseY={item.baseY}
              height={item.height}
              nodeId={item.nodeId}
              opacity={isEditing ? 0 : (item.opacity ?? 1)}
              renderRootNodeId={renderRootNodeId}
              src={item.src}
              width={item.width}
            />
          </svg>
        </g>
      );
    }

    if (item.type === "fallback-text") {
      return (
        <CanvasFallbackText {...item} isEditing={isEditing} key={item.key} />
      );
    }

    return (
      <g
        key={item.key}
        opacity={isEditing ? 0 : (item.opacity ?? 1)}
        transform={item.transform || undefined}
      >
        <CanvasAppearanceObjects objects={item.objects} />
      </g>
    );
  });
};
