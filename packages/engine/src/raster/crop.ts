import { getImageNodeBounds } from "../nodes/image/image-capabilities";
import {
  getNodeTransformForPinnedWorldPoint,
  getNodeWorldPoint,
} from "../primitives/rotation";

export const MAX_RASTER_CROP_DIMENSION = 16_384;
export const MAX_RASTER_CROP_AREA = 100_000_000;

export type RasterCropRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export const startRasterCrop = (editor, nodeId = editor.selectedNodeId) => {
  const node = editor.getNode(nodeId);
  const target = editor.getRasterTargetState({
    point: { x: 0, y: 0 },
    tool: "brush",
  });

  if (
    !(
      editor.selectedNodeIds.length === 1 &&
      node?.type === "image" &&
      target.enabled &&
      target.kind === "existing" &&
      target.nodeId === node.id
    )
  ) {
    return false;
  }

  editor.getState().setRasterCropSession({
    nodeId: node.id,
    rect: {
      height: node.height,
      width: node.width,
      x: 0,
      y: 0,
    },
  });
  return true;
};

export const updateRasterCrop = (editor, rect: RasterCropRect) => {
  const session = editor.getState().rasterCropSession;

  if (!session) {
    return false;
  }

  editor.getState().setRasterCropSession({
    ...session,
    rect: normalizeRasterCropRect(rect),
  });
  return true;
};

export const commitRasterCrop = (editor) => {
  const session = editor.getState().rasterCropSession;
  const node = session ? editor.getNode(session.nodeId) : null;

  if (!session) {
    return false;
  }

  if (node?.type !== "image") {
    editor.getState().setRasterCropSession(null);
    return false;
  }

  const isUnchanged =
    session.rect.x === 0 &&
    session.rect.y === 0 &&
    session.rect.width === node.width &&
    session.rect.height === node.height;

  editor.getState().setRasterCropSession(null);

  if (isUnchanged) {
    return false;
  }

  const rect = normalizeRasterCropRect(session.rect);
  const residentSnapshot =
    editor.rasterSurface?.snapshotSurface?.(node.id) || null;

  if (residentSnapshot) {
    editor.getState().updateNodeById(node.id, (currentNode) =>
      currentNode.type === "image"
        ? {
            ...currentNode,
            baseHeight: residentSnapshot.height,
            baseWidth: residentSnapshot.width,
            src: residentSnapshot.src,
          }
        : currentNode
    );
  }

  editor.run(() => {
    editor.getState().updateNodeById(node.id, (currentNode) => {
      if (currentNode.type !== "image") {
        return currentNode;
      }

      return getCroppedImageNode(currentNode, rect);
    });
  });
  return true;
};

export const cancelRasterCrop = (editor) => {
  if (!editor.getState().rasterCropSession) {
    return false;
  }

  editor.getState().setRasterCropSession(null);
  return true;
};

export const getRasterCropPreviewNode = (editor) => {
  const session = editor.getState().rasterCropSession;
  const node = session ? editor.getNode(session.nodeId) : null;

  return node?.type === "image"
    ? getCroppedImageNode(node, session.rect)
    : null;
};

export const getCroppedImageNode = (node, inputRect: RasterCropRect) => {
  const rect = normalizeRasterCropRect(inputRect);
  const pinnedWorldPoint = getNodeWorldPoint(
    node,
    getImageNodeBounds(node),
    {
      x: rect.x,
      y: rect.y,
    }
  );
  const nextNode = {
    ...node,
    baseHeight: node.baseHeight ?? node.height,
    baseWidth: node.baseWidth ?? node.width,
    baseX: (node.baseX ?? 0) - rect.x,
    baseY: (node.baseY ?? 0) - rect.y,
    height: rect.height,
    ...(node.tileSources
      ? {
          tileSources: node.tileSources.map((tile) => ({
            ...tile,
            x: tile.x - rect.x,
            y: tile.y - rect.y,
          })),
        }
      : {}),
    width: rect.width,
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

export const normalizeRasterCropRect = (
  rect: RasterCropRect
): RasterCropRect => {
  let width = clampInteger(rect.width, 1, MAX_RASTER_CROP_DIMENSION);
  let height = clampInteger(rect.height, 1, MAX_RASTER_CROP_DIMENSION);

  if (width * height > MAX_RASTER_CROP_AREA) {
    if (width >= height) {
      width = Math.max(1, Math.floor(MAX_RASTER_CROP_AREA / height));
    } else {
      height = Math.max(1, Math.floor(MAX_RASTER_CROP_AREA / width));
    }
  }

  return {
    height,
    width,
    x: clampInteger(
      rect.x,
      -MAX_RASTER_CROP_DIMENSION,
      MAX_RASTER_CROP_DIMENSION
    ),
    y: clampInteger(
      rect.y,
      -MAX_RASTER_CROP_DIMENSION,
      MAX_RASTER_CROP_DIMENSION
    ),
  };
};

const clampInteger = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
};
