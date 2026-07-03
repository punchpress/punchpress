import { getTopmostArtboardAtPoint } from "../nodes/artboard/artboard-hit-test";
import { getImageNodeBounds } from "../nodes/image/image-capabilities";
import { createDefaultImageNode } from "../nodes/image/model";
import { getNodeSourceKind } from "../nodes/node-capabilities";
import { round } from "../primitives/math";
import {
  getNodeLocalPoint,
  getNodeTransformForPinnedWorldPoint,
  getNodeWorldPoint,
} from "../primitives/rotation";
import { createTransparentImageDataUrl } from "./brush-runtime";

const BRUSH_LAYER_PADDING_MULTIPLIER = 2;

const getInitialBrushLayerMargin = (settings) => {
  return Math.max(2, Math.ceil(settings.size * BRUSH_LAYER_PADDING_MULTIPLIER));
};

export const getImageLocalPoint = (node, point) => {
  return getNodeLocalPoint(node, getImageNodeBounds(node), point);
};

/**
 * Current viewport in the image node's local space, used as the hydration
 * priority hint: on-screen tiles decode before offscreen ones.
 */
export const getImageLocalViewportBounds = (editor, node) => {
  const hostRect = editor.hostRef?.getBoundingClientRect?.();

  if (!(hostRect && node?.type === "image")) {
    return null;
  }

  const zoom = Math.max(0.0001, editor.zoom || 1);
  const viewport = editor.viewport || { x: 0, y: 0 };
  const corners = [
    { x: viewport.x, y: viewport.y },
    { x: viewport.x + hostRect.width / zoom, y: viewport.y },
    {
      x: viewport.x + hostRect.width / zoom,
      y: viewport.y + hostRect.height / zoom,
    },
    { x: viewport.x, y: viewport.y + hostRect.height / zoom },
  ].map((corner) => getImageLocalPoint(node, corner));

  if (corners.some((corner) => !corner)) {
    return null;
  }

  return {
    maxX: Math.max(...corners.map((corner) => corner.x)),
    maxY: Math.max(...corners.map((corner) => corner.y)),
    minX: Math.min(...corners.map((corner) => corner.x)),
    minY: Math.min(...corners.map((corner) => corner.y)),
  };
};

export const getNodeArtboardClipBounds = (editor, node) => {
  const parent = node?.parentId ? editor.getNode(node.parentId) : null;

  if (parent?.type !== "artboard") {
    return null;
  }

  return editor.getNodeRenderFrame(parent.id)?.bounds || null;
};

export const getImageLocalClipBounds = (editor, node) => {
  const bounds = getNodeArtboardClipBounds(editor, node);

  if (!bounds) {
    return null;
  }

  const points = [
    getImageLocalPoint(node, { x: bounds.minX, y: bounds.minY }),
    getImageLocalPoint(node, { x: bounds.maxX, y: bounds.minY }),
    getImageLocalPoint(node, { x: bounds.maxX, y: bounds.maxY }),
    getImageLocalPoint(node, { x: bounds.minX, y: bounds.maxY }),
  ];

  return {
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
  };
};

export const getArtboardClipSourceRect = (editor, node) => {
  const clipBounds = getImageLocalClipBounds(editor, node);

  if (!(node?.type === "image" && clipBounds)) {
    return null;
  }

  const minX = Math.max(0, Math.floor(clipBounds.minX));
  const minY = Math.max(0, Math.floor(clipBounds.minY));
  const maxX = Math.min(node.width, Math.ceil(clipBounds.maxX));
  const maxY = Math.min(node.height, Math.ceil(clipBounds.maxY));

  if (maxX <= minX || maxY <= minY) {
    return {
      height: 1,
      width: 1,
      x: Math.max(0, Math.min(node.width - 1, minX)),
      y: Math.max(0, Math.min(node.height - 1, minY)),
    };
  }

  const width = maxX - minX;
  const height = maxY - minY;

  if (
    minX === 0 &&
    minY === 0 &&
    width === node.width &&
    height === node.height
  ) {
    return null;
  }

  return {
    height,
    width,
    x: minX,
    y: minY,
  };
};

export const getImageNodeCroppedToSourceRect = (node, sourceRect) => {
  if (!(node?.type === "image" && sourceRect)) {
    return node;
  }

  const pinnedWorldPoint = getNodeWorldPoint(node, getImageNodeBounds(node), {
    x: sourceRect.x,
    y: sourceRect.y,
  });
  const nextNode = {
    ...node,
    height: sourceRect.height,
    width: sourceRect.width,
  };
  const transform = getNodeTransformForPinnedWorldPoint(
    nextNode,
    getImageNodeBounds(nextNode),
    { x: 0, y: 0 },
    pinnedWorldPoint
  );

  return {
    ...nextNode,
    transform: {
      ...node.transform,
      ...transform,
    },
  };
};

const createBrushImageNode = ({
  artboard = null,
  id,
  name,
  parentId,
  point,
  settings,
}) => {
  const margin = getInitialBrushLayerMargin(settings);
  const minX = artboard
    ? Math.max(point.x - margin, artboard.transform.x)
    : point.x - margin;
  const minY = artboard
    ? Math.max(point.y - margin, artboard.transform.y)
    : point.y - margin;
  const maxX = artboard
    ? Math.min(point.x + margin, artboard.transform.x + artboard.width)
    : point.x + margin;
  const maxY = artboard
    ? Math.min(point.y + margin, artboard.transform.y + artboard.height)
    : point.y + margin;
  const width = Math.max(1, Math.ceil(maxX - minX));
  const height = Math.max(1, Math.ceil(maxY - minY));
  const node = createDefaultImageNode({
    height,
    mimeType: "image/png",
    name: name || "Layer",
    src: createTransparentImageDataUrl(width, height),
    width,
  });

  return {
    ...node,
    id: id || node.id,
    name: name || node.name,
    parentId: parentId || node.parentId,
    transform: {
      ...node.transform,
      x: round(minX, 2),
      y: round(minY, 2),
    },
  };
};

const getSelectedSingleNode = (editor) => {
  if (editor.selectedNodeIds.length !== 1) {
    return null;
  }

  return editor.getNode(editor.selectedNodeIds[0]);
};

const canCreateRasterAtTarget = (node) => {
  const sourceKind = getNodeSourceKind(node);

  return !sourceKind || sourceKind === "artboard" || sourceKind === "empty";
};

export const resolveBrushTarget = (editor, point, node, settings) => {
  if (getNodeSourceKind(node) === "raster") {
    return node;
  }

  if (!canCreateRasterAtTarget(node)) {
    return null;
  }

  const selectedNode = getSelectedSingleNode(editor);

  if (getNodeSourceKind(selectedNode) === "raster") {
    return selectedNode;
  }

  if (getNodeSourceKind(selectedNode) === "empty") {
    const parentArtboard =
      selectedNode.parentId &&
      editor.getNode(selectedNode.parentId)?.type === "artboard"
        ? editor.getNode(selectedNode.parentId)
        : null;

    return createBrushImageNode({
      artboard: parentArtboard,
      id: selectedNode.id,
      name: selectedNode.name,
      parentId: selectedNode.parentId,
      point,
      settings,
    });
  }

  if (!canCreateRasterAtTarget(selectedNode)) {
    return null;
  }

  const artboard = getTopmostArtboardAtPoint(editor, point);

  return createBrushImageNode({
    artboard,
    parentId: artboard?.id,
    point,
    settings,
  });
};

export const materializeBrushTarget = (editor, targetNode) => {
  const existingNode = editor.getNode(targetNode.id);
  const activeTool = editor.activeTool;

  if (existingNode?.type === "image") {
    return targetNode;
  }

  if (existingNode?.type === "empty") {
    editor.getState().replaceNodeBlocks([existingNode.id], [targetNode]);
    return targetNode;
  }

  editor.getState().insertNodes([targetNode]);
  editor.getState().setActiveTool(activeTool);
  return targetNode;
};
