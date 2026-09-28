// @ts-nocheck TODO(typecheck-baseline): raster runtime exempt — in-flight redesign owns these files
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

const getOwningFrame = (editor, node) => {
  let parent = node?.parentId ? editor.getNode(node.parentId) : null;

  while (parent) {
    if (parent.type === "artboard") {
      return parent;
    }

    parent = parent.parentId ? editor.getNode(parent.parentId) : null;
  }

  return null;
};

export const getNodeArtboardClipBounds = (editor, node) => {
  const frame = getOwningFrame(editor, node);

  if (!frame) {
    return null;
  }

  return editor.getNodeRenderFrame(frame.id)?.bounds || null;
};

export const getImageLocalClipPolygon = (editor, node) => {
  const bounds = getNodeArtboardClipBounds(editor, node);

  if (!bounds) {
    return null;
  }

  return [
    getImageLocalPoint(node, { x: bounds.minX, y: bounds.minY }),
    getImageLocalPoint(node, { x: bounds.maxX, y: bounds.minY }),
    getImageLocalPoint(node, { x: bounds.maxX, y: bounds.maxY }),
    getImageLocalPoint(node, { x: bounds.minX, y: bounds.maxY }),
  ];
};

export const getImageLocalClipBounds = (editor, node) => {
  const points = getImageLocalClipPolygon(editor, node);

  if (!points) {
    return null;
  }

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
  opacity,
  parentId,
  point,
  settings,
  visible,
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
    opacity: opacity ?? node.opacity,
    parentId: parentId || node.parentId,
    visible: visible ?? node.visible,
    transform: {
      ...node.transform,
      x: round(minX, 2),
      y: round(minY, 2),
    },
  };
};

const isFrameWritable = (editor, frame) => {
  return Boolean(
    frame?.type === "artboard" &&
      !frame.locked &&
      editor.isNodeEffectivelyVisible(frame.id)
  );
};

const isNodeTreeUnlocked = (editor, node) => {
  let current = node;

  while (current) {
    if (current.locked === true) {
      return false;
    }

    current =
      current.parentId && current.parentId !== "root"
        ? editor.getNode(current.parentId)
        : null;
  }

  return true;
};

const isRasterWritable = (editor, node) => {
  if (
    !(
      getNodeSourceKind(node) === "raster" &&
      editor.isNodeEffectivelyVisible(node.id) &&
      isNodeTreeUnlocked(editor, node) &&
      !editor.getRasterResizeState?.(node.id)
    )
  ) {
    return false;
  }

  const frame = getOwningFrame(editor, node);

  return !frame || isFrameWritable(editor, frame);
};

export const getRasterTargetState = (
  editor,
  { tool = editor.activeTool }
) => {
  if (!(tool === "brush" || tool === "eraser")) {
    return { enabled: false, kind: "invalid" };
  }

  const activeNode = editor.activeLayer;

  if (isRasterWritable(editor, activeNode)) {
    return {
      enabled: true,
      kind: "existing",
      nodeId: activeNode.id,
    };
  }

  if (tool === "eraser") {
    return { enabled: false, kind: "invalid" };
  }

  if (getNodeSourceKind(activeNode) === "empty") {
    const frame = getOwningFrame(editor, activeNode);

    return isFrameWritable(editor, frame) &&
      editor.isNodeEffectivelyVisible(activeNode.id) &&
      isNodeTreeUnlocked(editor, activeNode)
      ? {
          enabled: true,
          frameId: frame.id,
          kind: "materialize",
          nodeId: activeNode.id,
        }
      : { enabled: false, kind: "invalid" };
  }

  if (activeNode?.type === "artboard") {
    return isFrameWritable(editor, activeNode)
      ? {
          enabled: true,
          frameId: activeNode.id,
          kind: "create",
        }
      : { enabled: false, kind: "invalid" };
  }

  return { enabled: false, kind: "invalid" };
};

export const resolveBrushTarget = (
  editor,
  point,
  settings,
  tool = editor.activeTool
) => {
  const state = getRasterTargetState(editor, { point, tool });

  return resolveBrushTargetState(editor, state, point, settings);
};

export const resolveBrushTargetState = (
  editor,
  state,
  point,
  settings
) => {
  if (!state.enabled) {
    return null;
  }

  if (state.kind === "existing") {
    return editor.getNode(state.nodeId);
  }

  const frame = editor.getNode(state.frameId);

  if (state.kind === "materialize") {
    const selectedNode = editor.getNode(state.nodeId);

    if (!(selectedNode?.type === "empty" && isFrameWritable(editor, frame))) {
      return null;
    }

    return createBrushImageNode({
      artboard: frame,
      id: selectedNode.id,
      name: selectedNode.name,
      opacity: selectedNode.opacity,
      parentId: selectedNode.parentId,
      point,
      settings,
      visible: selectedNode.visible,
    });
  }

  if (!isFrameWritable(editor, frame)) {
    return null;
  }

  return createBrushImageNode({
    artboard: frame,
    parentId: frame.id,
    point,
    settings,
  });
};

export const getRasterWritableBounds = (editor, node) => {
  if (node?.type !== "image") {
    return null;
  }

  const clipBounds = getImageLocalClipBounds(editor, node);

  if (clipBounds) {
    return {
      height: Math.max(0, clipBounds.maxY - clipBounds.minY),
      width: Math.max(0, clipBounds.maxX - clipBounds.minX),
      x: clipBounds.minX,
      y: clipBounds.minY,
    };
  }

  const hasStoredWritableBounds =
    Number.isFinite(node.writableX) &&
    Number.isFinite(node.writableY) &&
    Number.isFinite(node.writableWidth) &&
    Number.isFinite(node.writableHeight) &&
    node.writableWidth > 0 &&
    node.writableHeight > 0;

  return {
    height: hasStoredWritableBounds ? node.writableHeight : node.height,
    width: hasStoredWritableBounds ? node.writableWidth : node.width,
    x: hasStoredWritableBounds ? node.writableX : 0,
    y: hasStoredWritableBounds ? node.writableY : 0,
  };
};

export const getRasterSurfaceBounds = (editor, node) => {
  if (node?.type !== "image") {
    return null;
  }

  const sourceBounds = {
    height: node.baseHeight ?? node.height,
    width: node.baseWidth ?? node.width,
    x: node.baseX ?? 0,
    y: node.baseY ?? 0,
  };
  const writableBounds = getRasterWritableBounds(editor, node);

  if (!writableBounds) {
    return sourceBounds;
  }

  const x = Math.min(sourceBounds.x, writableBounds.x);
  const y = Math.min(sourceBounds.y, writableBounds.y);
  const maxX = Math.max(
    sourceBounds.x + sourceBounds.width,
    writableBounds.x + writableBounds.width
  );
  const maxY = Math.max(
    sourceBounds.y + sourceBounds.height,
    writableBounds.y + writableBounds.height
  );

  return { height: maxY - y, width: maxX - x, x, y };
};

export const getRasterSurfacePixelSize = (editor, node) => {
  const bounds = getRasterSurfaceBounds(editor, node);

  if (!(bounds && node?.type === "image")) {
    return null;
  }

  const sourceWidth = node.baseWidth ?? node.width;
  const sourceHeight = node.baseHeight ?? node.height;
  const scaleX = (node.pixelWidth ?? sourceWidth) / sourceWidth;
  const scaleY = (node.pixelHeight ?? sourceHeight) / sourceHeight;

  return {
    height: Math.max(1, Math.ceil(bounds.height * scaleY)),
    width: Math.max(1, Math.ceil(bounds.width * scaleX)),
  };
};

export const getRasterWritablePolygon = (editor, node) => {
  if (node?.type !== "image") {
    return null;
  }

  const framePolygon = getImageLocalClipPolygon(editor, node);

  if (framePolygon) {
    return framePolygon;
  }

  const bounds = getRasterWritableBounds(editor, node);

  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];
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
