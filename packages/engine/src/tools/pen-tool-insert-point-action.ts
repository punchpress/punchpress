import { replaceVectorContourSegment } from "../nodes/vector/vector-contour-operations";
import { getNodeLocalPoint, getNodeWorldPoint } from "../primitives/rotation";
import type { PenTool } from "./pen-tool";
import { createPlacementSession, getPenDragHandle } from "./pen-tool-types";

interface PointPlacement {
  contourIndex: number;
  segmentIndex: number;
}

interface InsertPointPlacement {
  anchorCanvasPoint: { x: number; y: number };
  anchorLocalPoint: { x: number; y: number };
  baseContours: unknown[];
  currentCanvasPoint: { x: number; y: number };
  historyMark: unknown;
  nodeId: string;
  point: PointPlacement;
}

const startInsertPointPlacement = (tool: PenTool, node, target) => {
  const bbox = tool.editor.getNodeGeometry(node.id)?.bbox;
  const insertedPoint = target.segments[target.segmentIndex]?.point;
  const historyMark = tool.editor.markHistoryStep("edit vector path");

  if (!(bbox && insertedPoint && historyMark)) {
    return null;
  }

  const anchorCanvasPoint = getNodeWorldPoint(node, bbox, insertedPoint);
  const didInsert = tool.editor.insertVectorPoint(target, node.id);

  if (!didInsert) {
    tool.editor.revertToMark(historyMark);
    return null;
  }

  const insertedNode = tool.editor.getNode(node.id);

  if (insertedNode?.type !== "vector") {
    tool.editor.revertToMark(historyMark);
    return null;
  }

  tool.idleHoverTarget = null;
  tool.editor.notifyInteractionPreviewChanged();

  return {
    anchorCanvasPoint,
    anchorLocalPoint: insertedPoint,
    baseContours: insertedNode.contours,
    currentCanvasPoint: anchorCanvasPoint,
    historyMark,
    nodeId: node.id,
    point: {
      contourIndex: target.contourIndex,
      segmentIndex: target.segmentIndex,
    },
  } satisfies InsertPointPlacement;
};

const getInsertPointPlacementContours = (
  tool: PenTool,
  placement: InsertPointPlacement,
  point,
  { spaceKey = false } = {}
) => {
  const node = tool.editor.getNode(placement.nodeId);
  const bbox = tool.editor.getNodeGeometry(placement.nodeId)?.bbox;

  if (!(node?.type === "vector" && bbox && point)) {
    return placement.baseContours;
  }

  const nextCanvasPoint = {
    x: Math.round(point.x * 100) / 100,
    y: Math.round(point.y * 100) / 100,
  };

  if (spaceKey) {
    placement.anchorCanvasPoint = {
      x:
        Math.round(
          (placement.anchorCanvasPoint.x +
            (nextCanvasPoint.x - placement.currentCanvasPoint.x)) *
            100
        ) / 100,
      y:
        Math.round(
          (placement.anchorCanvasPoint.y +
            (nextCanvasPoint.y - placement.currentCanvasPoint.y)) *
            100
        ) / 100,
    };
    placement.anchorLocalPoint = {
      x:
        Math.round(
          getNodeLocalPoint(node, bbox, placement.anchorCanvasPoint).x * 100
        ) / 100,
      y:
        Math.round(
          getNodeLocalPoint(node, bbox, placement.anchorCanvasPoint).y * 100
        ) / 100,
    };
    placement.currentCanvasPoint = nextCanvasPoint;

    return replaceVectorContourSegment(node.contours, {
      contourIndex: placement.point.contourIndex,
      point: placement.anchorLocalPoint,
      segmentIndex: placement.point.segmentIndex,
    });
  }

  const currentLocalPoint = getNodeLocalPoint(node, bbox, point);
  const dragHandle = getPenDragHandle({
    anchorCanvasPoint: placement.anchorCanvasPoint,
    anchorLocalPoint: placement.anchorLocalPoint,
    currentCanvasPoint: point,
    currentLocalPoint,
  });

  placement.currentCanvasPoint = nextCanvasPoint;

  if (!dragHandle) {
    return placement.baseContours;
  }

  return replaceVectorContourSegment(placement.baseContours, {
    contourIndex: placement.point.contourIndex,
    handleIn: {
      x: -dragHandle.x,
      y: -dragHandle.y,
    },
    handleOut: dragHandle,
    pointType: "smooth",
    segmentIndex: placement.point.segmentIndex,
  });
};

const updateInsertPointPlacement = (
  tool: PenTool,
  placement: InsertPointPlacement,
  point,
  options = {}
) => {
  const nextContours = getInsertPointPlacementContours(
    tool,
    placement,
    point,
    options
  );

  return tool.editor.updateVectorContours(placement.nodeId, nextContours, {
    pinnedLocalPoint: placement.anchorLocalPoint,
    pinnedWorldPoint: placement.anchorCanvasPoint,
  });
};

const cancelInsertPointPlacement = (
  tool: PenTool,
  placement: InsertPointPlacement
) => {
  return tool.editor.revertToMark(placement.historyMark);
};

const completeInsertPointPlacement = (
  tool: PenTool,
  placement: InsertPointPlacement,
  point,
  options = {}
) => {
  if (!updateInsertPointPlacement(tool, placement, point, options)) {
    return false;
  }

  return tool.editor.commitHistoryStep(placement.historyMark);
};

export const startInsertPointAction = (tool: PenTool, node, target, point) => {
  const placement = startInsertPointPlacement(tool, node, target);

  if (!placement) {
    return null;
  }

  return createPlacementSession(
    () => cancelInsertPointPlacement(tool, placement),
    ({ point: nextPoint = point, ...options } = {}) =>
      completeInsertPointPlacement(tool, placement, nextPoint, options),
    ({ point: nextPoint = point, ...options } = {}) =>
      updateInsertPointPlacement(tool, placement, nextPoint, options)
  );
};
