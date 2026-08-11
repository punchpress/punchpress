import {
  buildNodeCapabilityGeometry,
  getNodeFrameFromGeometry,
} from "../nodes/node-capabilities";
import { getImageNodeBounds } from "../nodes/image/image-capabilities";
import { getScaledImageNodeUpdate } from "../primitives/group-resize";
import {
  getNodeLocalPoint,
  getNodeTransformForPinnedWorldPoint,
} from "../primitives/rotation";
import {
  getRasterSurfaceBounds,
  getRasterSurfacePixelSize,
} from "../tools/brush-target";
import {
  MAX_RASTER_CROP_AREA,
  MAX_RASTER_CROP_DIMENSION,
} from "./crop";

export const resizeRaster = async (
  editor,
  nodeId,
  { height = undefined, transform = undefined, width = undefined } = {}
) => {
  const node = editor.getNode(nodeId);

  if (!(node?.type === "image" && editor.rasterSurface?.resampleSurface)) {
    return false;
  }

  if (editor.rasterResizeOperations.has(nodeId)) {
    cancelRasterResize(editor, nodeId);
  }

  const currentPixelSize = getRasterSurfacePixelSize(editor, node);
  const requested = { height, width };
  const requestedTargetSize = getTargetSize(editor, node, requested);

  if (!(currentPixelSize && requestedTargetSize)) {
    return false;
  }

  const targetSize = constrainTargetSize(
    editor,
    node,
    requested,
    requestedTargetSize,
    currentPixelSize
  );
  const nextTransform = transform
    ? { ...node.transform, ...transform }
    : node.transform;

  if (
    targetSize.height === node.height &&
    targetSize.width === node.width &&
    areTransformsEqual(nextTransform, node.transform)
  ) {
    editor.setSelectionDragPreview(null);
    return false;
  }

  const scaleX = targetSize.width / node.width;
  const scaleY = targetSize.height / node.height;
  const scaledNode = {
    ...node,
    ...getScaledImageNodeUpdate(node, scaleX, scaleY),
    height: targetSize.height,
    transform: nextTransform,
    width: targetSize.width,
  };

  const pixelSize = {
    height: Math.max(1, Math.round(currentPixelSize.height * scaleY)),
    width: Math.max(1, Math.round(currentPixelSize.width * scaleX)),
  };
  const nextNode = {
    ...scaledNode,
    pixelHeight: pixelSize.height,
    pixelWidth: pixelSize.width,
  };
  const sourceBounds = {
    height: nextNode.baseHeight ?? nextNode.height,
    width: nextNode.baseWidth ?? nextNode.width,
    x: nextNode.baseX ?? 0,
    y: nextNode.baseY ?? 0,
  };
  const bounds = getRasterSurfaceBounds(editor, nextNode);
  const historyMark = editor.markHistoryStep("resize raster");
  const operationId = Symbol(nodeId);

  editor.rasterResizeOperations.set(nodeId, operationId);
  editor.rasterResizeStates.set(nodeId, {
    phase: "resampling",
    targetHeight: targetSize.height,
    targetWidth: targetSize.width,
  });
  setResizePreview(editor, nextNode);
  editor.notifyInteractionPreviewChanged();

  try {
    const effect = await editor.rasterSurface.resampleSurface({
      bounds,
      pixelSize,
      sourceBounds,
      targetId: nodeId,
    });

    if (
      editor.rasterResizeOperations.get(nodeId) !== operationId ||
      editor.getNode(nodeId) !== node
    ) {
      editor.commitHistoryStep(historyMark);
      return false;
    }

    effect?.redo();
    editor.getState().updateNodeById(nodeId, nextNode);
    editor.commitHistoryStep(historyMark, effect);
    return true;
  } catch {
    editor.commitHistoryStep(historyMark);
    return false;
  } finally {
    if (editor.rasterResizeOperations.get(nodeId) === operationId) {
      editor.rasterResizeOperations.delete(nodeId);
      editor.rasterResizeStates.delete(nodeId);
      editor.setSelectionDragPreview(null);
      editor.notifyInteractionPreviewChanged();
    }
  }
};

export const cancelRasterResize = (editor, nodeId = undefined) => {
  const targetIds = nodeId
    ? [nodeId]
    : [...editor.rasterResizeOperations.keys()];

  for (const targetId of targetIds) {
    editor.rasterSurface?.cancelResample?.(targetId);
    editor.rasterResizeOperations.delete(targetId);
    editor.rasterResizeStates.delete(targetId);
  }

  if (targetIds.length > 0) {
    editor.setSelectionDragPreview(null);
    editor.notifyInteractionPreviewChanged();
  }
};

export const beginRasterResize = (editor, nodeId) => {
  const node = editor.getNode(nodeId);

  if (!(node?.type === "image" && !editor.getRasterResizeState(nodeId))) {
    return null;
  }

  return { baseNode: node, nodeId, previewNode: node };
};

export const updateRasterResize = (editor, session, size) => {
  const node = editor.getNode(session?.nodeId);

  if (!(node?.type === "image" && node === session.baseNode)) {
    return null;
  }

  const targetSize = getTargetSize(editor, session.baseNode, size);

  if (!targetSize) {
    return null;
  }

  const scaleX = targetSize.width / session.baseNode.width;
  const scaleY = targetSize.height / session.baseNode.height;
  session.previewNode = {
    ...session.baseNode,
    ...getScaledImageNodeUpdate(session.baseNode, scaleX, scaleY),
    height: targetSize.height,
    width: targetSize.width,
  };
  setResizePreview(editor, session.previewNode);
  return targetSize;
};

export const commitRasterResize = (editor, session) => {
  const node = editor.getNode(session?.nodeId);
  const previewNode = session?.previewNode;

  if (!(node?.type === "image" && previewNode?.type === "image")) {
    editor.setSelectionDragPreview(null);
    return Promise.resolve(false);
  }

  return resizeRaster(editor, node.id, {
    height: previewNode.height,
    transform: previewNode.transform,
    width: previewNode.width,
  });
};

export const getRasterBoxResizeUpdate = (
  editor,
  node,
  bounds,
  anchorCanvas,
  pointCanvas,
  handle,
  { preserveAspectRatio = false } = {}
) => {
  if (!(node?.type === "image" && anchorCanvas && pointCanvas && handle)) {
    return null;
  }

  const pointer = getNodeLocalPoint(node, bounds, pointCanvas);
  let width = node.width;
  let height = node.height;

  if (handle.endsWith("w")) {
    width = Math.max(1, node.width - pointer.x);
  } else if (handle.endsWith("e")) {
    width = Math.max(1, pointer.x);
  }

  if (handle.startsWith("n")) {
    height = Math.max(1, node.height - pointer.y);
  } else if (handle.startsWith("s")) {
    height = Math.max(1, pointer.y);
  }

  if (
    preserveAspectRatio ||
    editor.isRasterAspectRatioLocked(node.id)
  ) {
    const horizontalScale = width / node.width;
    const verticalScale = height / node.height;
    const scale =
      handle.length === 1
        ? handle === "e" || handle === "w"
          ? horizontalScale
          : verticalScale
        : Math.max(horizontalScale, verticalScale);

    width = node.width * scale;
    height = node.height * scale;
  }

  width = Math.max(1, Math.round(width));
  height = Math.max(1, Math.round(height));
  const scaleX = width / node.width;
  const scaleY = height / node.height;
  const nextNode = {
    ...node,
    ...getScaledImageNodeUpdate(node, scaleX, scaleY),
    height,
    width,
  };
  const nextBounds = getImageNodeBounds(nextNode);
  const anchorLocal = getOppositeHandlePoint(nextBounds, handle);

  return {
    ...nextNode,
    transform: {
      ...node.transform,
      ...getNodeTransformForPinnedWorldPoint(
        nextNode,
        nextBounds,
        anchorLocal,
        anchorCanvas
      ),
    },
  };
};

const getTargetSize = (editor, node, requested) => {
  const requestedWidth = Number.isFinite(requested.width)
    ? clampDimension(requested.width)
    : null;
  const requestedHeight = Number.isFinite(requested.height)
    ? clampDimension(requested.height)
    : null;

  if (!(requestedWidth || requestedHeight)) {
    return null;
  }

  if (!editor.isRasterAspectRatioLocked(node.id)) {
    return {
      height: requestedHeight ?? Math.max(1, Math.round(node.height)),
      width: requestedWidth ?? Math.max(1, Math.round(node.width)),
    };
  }

  if (requestedWidth) {
    return {
      height: Math.max(1, Math.round((node.height * requestedWidth) / node.width)),
      width: requestedWidth,
    };
  }

  return {
    height: requestedHeight,
    width: clampDimension((node.width * requestedHeight) / node.height),
  };
};

const constrainTargetSize = (
  editor,
  node,
  requested,
  targetSize,
  currentPixelSize
) => {
  const predicted = {
    height: Math.max(
      1,
      Math.round((currentPixelSize.height * targetSize.height) / node.height)
    ),
    width: Math.max(
      1,
      Math.round((currentPixelSize.width * targetSize.width) / node.width)
    ),
  };

  if (
    predicted.width <= MAX_RASTER_CROP_DIMENSION &&
    predicted.height <= MAX_RASTER_CROP_DIMENSION &&
    predicted.width * predicted.height <= MAX_RASTER_CROP_AREA
  ) {
    return targetSize;
  }

  const requestedBoth =
    Number.isFinite(requested.width) && Number.isFinite(requested.height);

  if (editor.isRasterAspectRatioLocked(node.id) || requestedBoth) {
    const scale = Math.min(
      1,
      MAX_RASTER_CROP_DIMENSION / predicted.width,
      MAX_RASTER_CROP_DIMENSION / predicted.height,
      Math.sqrt(MAX_RASTER_CROP_AREA / (predicted.width * predicted.height))
    );

    return enforcePixelLimits(
      node,
      {
        height: Math.max(1, Math.floor(targetSize.height * scale)),
        width: Math.max(1, Math.floor(targetSize.width * scale)),
      },
      currentPixelSize
    );
  }

  if (Number.isFinite(requested.width)) {
    const maxPixelWidth = Math.min(
      MAX_RASTER_CROP_DIMENSION,
      Math.floor(MAX_RASTER_CROP_AREA / predicted.height)
    );

    return enforcePixelLimits(
      node,
      {
        height: targetSize.height,
        width: Math.max(
          1,
          Math.floor((node.width * maxPixelWidth) / currentPixelSize.width)
        ),
      },
      currentPixelSize
    );
  }

  const maxPixelHeight = Math.min(
    MAX_RASTER_CROP_DIMENSION,
    Math.floor(MAX_RASTER_CROP_AREA / predicted.width)
  );

  return enforcePixelLimits(
    node,
    {
      height: Math.max(
        1,
        Math.floor((node.height * maxPixelHeight) / currentPixelSize.height)
      ),
      width: targetSize.width,
    },
    currentPixelSize
  );
};

const enforcePixelLimits = (node, targetSize, currentPixelSize) => {
  const nextSize = { ...targetSize };
  let predicted = getPredictedPixelSize(node, nextSize, currentPixelSize);

  if (predicted.width > MAX_RASTER_CROP_DIMENSION) {
    nextSize.width = getGeometryLimit(
      node.width,
      currentPixelSize.width,
      MAX_RASTER_CROP_DIMENSION
    );
  }

  if (predicted.height > MAX_RASTER_CROP_DIMENSION) {
    nextSize.height = getGeometryLimit(
      node.height,
      currentPixelSize.height,
      MAX_RASTER_CROP_DIMENSION
    );
  }

  predicted = getPredictedPixelSize(node, nextSize, currentPixelSize);

  if (predicted.width * predicted.height <= MAX_RASTER_CROP_AREA) {
    return nextSize;
  }

  if (predicted.width >= predicted.height) {
    nextSize.width = getGeometryLimit(
      node.width,
      currentPixelSize.width,
      Math.floor(MAX_RASTER_CROP_AREA / predicted.height)
    );
  } else {
    nextSize.height = getGeometryLimit(
      node.height,
      currentPixelSize.height,
      Math.floor(MAX_RASTER_CROP_AREA / predicted.width)
    );
  }

  return nextSize;
};

const getPredictedPixelSize = (node, targetSize, currentPixelSize) => ({
  height: Math.max(
    1,
    Math.round((currentPixelSize.height * targetSize.height) / node.height)
  ),
  width: Math.max(
    1,
    Math.round((currentPixelSize.width * targetSize.width) / node.width)
  ),
});

const getGeometryLimit = (geometrySize, pixelSize, pixelLimit) =>
  Math.max(
    1,
    Math.floor(((pixelLimit + 0.499_999) * geometrySize) / pixelSize)
  );

const clampDimension = (value) =>
  Math.min(MAX_RASTER_CROP_DIMENSION, Math.max(1, Math.round(value)));

const areTransformsEqual = (left, right) => {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);

  return [...keys].every((key) => left[key] === right[key]);
};

const setResizePreview = (editor, node) => {
  const geometry = buildNodeCapabilityGeometry(node);
  const renderFrame = getNodeFrameFromGeometry(node, geometry, "render");
  const transformFrame = getNodeFrameFromGeometry(node, geometry, "transform");

  if (!(renderFrame && transformFrame)) {
    return;
  }

  editor.setSelectionDragPreview({
    effectiveNodeIdSet: new Set([node.id]),
    nodeIdSet: new Set([node.id]),
    nodeIds: [node.id],
    resize: {
      frame: renderFrame,
      nodeUpdate: nextNodeUpdate(node),
      transformFrame,
    },
  });
};

const nextNodeUpdate = (node) => ({
  baseHeight: node.baseHeight,
  baseWidth: node.baseWidth,
  baseX: node.baseX,
  baseY: node.baseY,
  height: node.height,
  transform: node.transform,
  width: node.width,
});

const getOppositeHandlePoint = (bounds, handle) => {
  const centerX = bounds.width / 2;
  const centerY = bounds.height / 2;

  switch (handle) {
    case "e":
      return { x: 0, y: centerY };
    case "n":
      return { x: centerX, y: bounds.height };
    case "ne":
      return { x: 0, y: bounds.height };
    case "nw":
      return { x: bounds.width, y: bounds.height };
    case "s":
      return { x: centerX, y: 0 };
    case "se":
      return { x: 0, y: 0 };
    case "sw":
      return { x: bounds.width, y: 0 };
    case "w":
      return { x: bounds.width, y: centerY };
    default:
      return { x: 0, y: 0 };
  }
};
