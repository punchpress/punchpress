import { round } from "../primitives/math";
import {
  resolveContinuationTarget,
  resolveDeletePointTarget,
  resolveInsertPointTarget,
  resolvePointTypeToggleTarget,
} from "./pen-existing-point-actions";
import type { PenTool } from "./pen-tool";
import { getActiveAuthoringSession } from "./pen-tool-authoring-session";
import { setHoverPoint } from "./pen-tool-close-target";
import { getNodeContour, isPenEditableNode } from "./pen-tool-types";

const createAnchorHoverState = (node, target, intent) => {
  const hoverPoint =
    getNodeContour(node, target.contourIndex)?.segments[target.segmentIndex]?.point;

  if (!hoverPoint) {
    return null;
  }

  return {
    contourIndex: target.contourIndex,
    intent,
    nodeId: node.id,
    point: {
      x: round(hoverPoint.x, 2),
      y: round(hoverPoint.y, 2),
    },
    role: "anchor" as const,
    segmentIndex: target.segmentIndex,
  };
};

const createSegmentHoverState = (nodeId, target) => {
  const hoverPoint = target.segments[target.segmentIndex]?.point;

  if (!hoverPoint) {
    return null;
  }

  return {
    contourIndex: target.contourIndex,
    intent: "add" as const,
    nodeId,
    point: {
      x: round(hoverPoint.x, 2),
      y: round(hoverPoint.y, 2),
    },
    role: "segment" as const,
    segmentIndex: target.segmentIndex,
  };
};

const resolveIdlePenHoverState = (tool: PenTool, node, point, event = null) => {
  if (!isPenEditableNode(node)) {
    return null;
  }

  const pointTypeToggleTarget =
    event?.altKey && node
      ? resolvePointTypeToggleTarget(tool.editor, node, point)
      : null;

  if (pointTypeToggleTarget) {
    const segment =
      getNodeContour(node, pointTypeToggleTarget.contourIndex)?.segments[
        pointTypeToggleTarget.segmentIndex
      ];

    if (!segment) {
      return null;
    }

    return createAnchorHoverState(
      node,
      pointTypeToggleTarget,
      segment.pointType === "smooth" ? "convert-to-corner" : "convert-to-smooth"
    );
  }

  const continuationTarget = resolveContinuationTarget(
    tool.editor,
    node,
    point
  );

  if (continuationTarget) {
    return createAnchorHoverState(node, continuationTarget, "continue");
  }

  const deletePointTarget = resolveDeletePointTarget(tool.editor, node, point);

  if (deletePointTarget) {
    return createAnchorHoverState(node, deletePointTarget, "delete");
  }

  const insertPointTarget = resolveInsertPointTarget(tool.editor, node, point);

  if (!insertPointTarget) {
    return null;
  }

  return createSegmentHoverState(node.id, insertPointTarget);
};

export const setIdleHoverTarget = (tool: PenTool, point, event = null) => {
  const nodeId = tool.editor.pathEditingNodeId || tool.editor.selectedNodeId;
  const node = nodeId ? tool.editor.getNode(nodeId) : null;
  const nextIdleHoverTarget = resolveIdlePenHoverState(
    tool,
    node,
    point,
    event
  );

  const didChange =
    tool.idleHoverTarget?.nodeId !== nextIdleHoverTarget?.nodeId ||
    tool.idleHoverTarget?.contourIndex !== nextIdleHoverTarget?.contourIndex ||
    tool.idleHoverTarget?.intent !== nextIdleHoverTarget?.intent ||
    tool.idleHoverTarget?.role !== nextIdleHoverTarget?.role ||
    tool.idleHoverTarget?.segmentIndex !== nextIdleHoverTarget?.segmentIndex ||
    tool.idleHoverTarget?.point.x !== nextIdleHoverTarget?.point.x ||
    tool.idleHoverTarget?.point.y !== nextIdleHoverTarget?.point.y;

  if (!didChange) {
    return false;
  }

  tool.idleHoverTarget = nextIdleHoverTarget;
  tool.editor.notifyInteractionPreviewChanged();
  return true;
};

export const clearIdleHoverTarget = (tool: PenTool) => {
  if (!tool.idleHoverTarget) {
    return false;
  }

  tool.idleHoverTarget = null;
  tool.editor.notifyInteractionPreviewChanged();
  return true;
};

export const handlePenCanvasPointerLeave = (tool: PenTool) => {
  const session = getActiveAuthoringSession(tool);
  let didChange = false;

  if (
    session &&
    !session.draft &&
    (session.hoverPoint || session.hoverTarget)
  ) {
    session.hoverPoint = null;
    session.hoverTarget = null;
    didChange = true;
  }

  if (tool.idleHoverTarget) {
    tool.idleHoverTarget = null;
    didChange = true;
  }

  if (didChange) {
    tool.editor.notifyInteractionPreviewChanged();
  }

  return didChange;
};

export const handlePenCanvasPointerMove = (tool: PenTool, { event, point }) => {
  const session = getActiveAuthoringSession(tool);

  if (!point) {
    return false;
  }

  if (session && !session.draft) {
    return setHoverPoint(tool, session, point);
  }

  return setIdleHoverTarget(tool, point, event);
};
