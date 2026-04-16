import { setVectorPointHandlesFromAnchorDrag } from "../nodes/vector/point-edit";
import { getNodeLocalPoint, getNodeWorldPoint } from "../primitives/rotation";
import type { PenTool } from "./pen-tool";
import {
  createPlacementSession,
  getNodeContour,
  getNodeContours,
  getPenDragHandle,
  isPenEditableNode,
} from "./pen-tool-types";

interface PointPlacement {
  contourIndex: number;
  segmentIndex: number;
}

interface PointTypeTogglePlacement {
  anchorCanvasPoint: { x: number; y: number };
  anchorLocalPoint: { x: number; y: number };
  baseContours: unknown[];
  historyMark: unknown;
  initialPointType: "corner" | "smooth";
  nodeId: string;
  point: PointPlacement;
}

const startPointTypeTogglePlacement = (tool: PenTool, node, target) => {
  const bbox = tool.editor.getNodeGeometry(node.id)?.bbox;
  const segment =
    getNodeContour(node, target.contourIndex)?.segments[target.segmentIndex];

  if (!(bbox && segment)) {
    return null;
  }

  return {
    anchorCanvasPoint: getNodeWorldPoint(node, bbox, segment.point),
    anchorLocalPoint: segment.point,
    baseContours: getNodeContours(node),
    historyMark: null,
    initialPointType: segment.pointType || "corner",
    nodeId: node.id,
    point: target,
  } satisfies PointTypeTogglePlacement;
};

const ensurePointTypeTogglePlacementHistory = (
  tool: PenTool,
  placement: PointTypeTogglePlacement
) => {
  if (placement.historyMark) {
    return true;
  }

  const historyMark = tool.editor.markHistoryStep("edit vector path");

  if (!historyMark) {
    return false;
  }

  placement.historyMark = historyMark;
  tool.editor.setPathEditingPoint(placement.point);
  return true;
};

const getPointTypeTogglePlacementContours = (
  tool: PenTool,
  placement: PointTypeTogglePlacement,
  point
) => {
  const node = tool.editor.getNode(placement.nodeId);
  const bbox = tool.editor.getNodeGeometry(placement.nodeId)?.bbox;

  if (!(isPenEditableNode(node) && bbox && point)) {
    return placement.baseContours;
  }

  const currentLocalPoint = getNodeLocalPoint(node, bbox, point);
  const dragHandle = getPenDragHandle({
    anchorCanvasPoint: placement.anchorCanvasPoint,
    anchorLocalPoint: placement.anchorLocalPoint,
    currentCanvasPoint: point,
    currentLocalPoint,
  });

  if (!dragHandle) {
    return placement.baseContours;
  }

  return setVectorPointHandlesFromAnchorDrag(placement.baseContours, {
    contourIndex: placement.point.contourIndex,
    segmentIndex: placement.point.segmentIndex,
    value: dragHandle,
  });
};

const updatePointTypeTogglePlacement = (
  tool: PenTool,
  placement: PointTypeTogglePlacement,
  point
) => {
  if (placement.initialPointType !== "corner") {
    return false;
  }

  const nextContours = getPointTypeTogglePlacementContours(
    tool,
    placement,
    point
  );

  if (nextContours === placement.baseContours && !placement.historyMark) {
    return false;
  }

  if (!ensurePointTypeTogglePlacementHistory(tool, placement)) {
    return false;
  }

  return tool.editor.updateVectorContours(placement.nodeId, nextContours);
};

const cancelPointTypeTogglePlacement = (
  tool: PenTool,
  placement: PointTypeTogglePlacement
) => {
  if (!placement.historyMark) {
    return false;
  }

  return tool.editor.revertToMark(placement.historyMark);
};

const completePointTypeTogglePlacement = (
  tool: PenTool,
  placement: PointTypeTogglePlacement,
  point
) => {
  const didAuthorHandles =
    placement.initialPointType === "corner"
      ? updatePointTypeTogglePlacement(tool, placement, point)
      : false;

  if (didAuthorHandles && placement.historyMark) {
    return tool.editor.commitHistoryStep(placement.historyMark);
  }

  if (placement.historyMark) {
    tool.editor.revertToMark(placement.historyMark);
    placement.historyMark = null;
  }

  const node = tool.editor.getNode(placement.nodeId);
  const segment =
    getNodeContour(node, placement.point.contourIndex)?.segments[
      placement.point.segmentIndex
    ];

  if (!segment) {
    return false;
  }

  const nextPointType = segment.pointType === "smooth" ? "corner" : "smooth";

  tool.editor.setPathEditingPoint(placement.point);
  const didToggle = tool.editor.setPathPointType(
    nextPointType,
    placement.nodeId,
    placement.point
  );

  if (!didToggle) {
    return false;
  }

  tool.idleHoverTarget = null;
  tool.editor.notifyInteractionPreviewChanged();
  return true;
};

export const startPointTypeToggleAction = (
  tool: PenTool,
  node,
  target,
  point
) => {
  const placement = startPointTypeTogglePlacement(tool, node, target);

  if (!placement) {
    return null;
  }

  return createPlacementSession(
    () => cancelPointTypeTogglePlacement(tool, placement),
    ({ point: nextPoint = point } = {}) =>
      completePointTypeTogglePlacement(tool, placement, nextPoint),
    ({ point: nextPoint = point } = {}) =>
      updatePointTypeTogglePlacement(tool, placement, nextPoint)
  );
};
