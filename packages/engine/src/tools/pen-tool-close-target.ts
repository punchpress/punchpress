import { VECTOR_ANCHOR_INTERACTION_RADIUS_PX } from "../nodes/vector/interaction-constants";
import { round } from "../primitives/math";
import { getNodeLocalPoint, getNodeWorldPoint } from "../primitives/rotation";
import type { PenTool } from "./pen-tool";
import { isSamePoint } from "./pen-tool-types";

export const resolveCloseTarget = (
  tool: PenTool,
  node,
  bbox,
  point,
  contour
) => {
  const startPoint = contour.segments[0]?.point;

  if (
    !startPoint ||
    contour.segments.length < 2 ||
    !shouldCloseContour(tool, node, bbox, point, startPoint)
  ) {
    return null;
  }

  return {
    segmentIndex: 0,
    type: "start-anchor",
  } as const;
};

export const setHoverPoint = (tool: PenTool, session, point) => {
  const node = tool.editor.getNode(session.nodeId);
  const bbox = tool.editor.getNodeGeometry(session.nodeId)?.bbox;
  const contour =
    node?.type === "vector" ? node.contours[session.contourIndex] : null;

  if (!(node?.type === "vector" && bbox && contour)) {
    return false;
  }

  const nextHoverPoint = getNodeLocalPoint(node, bbox, point);
  const nextHoverTarget = resolveCloseTarget(tool, node, bbox, point, contour);
  const didHoverPointChange = !(
    session.hoverPoint && isSamePoint(session.hoverPoint, nextHoverPoint)
  );
  const didHoverTargetChange =
    session.hoverTarget?.type !== nextHoverTarget?.type ||
    session.hoverTarget?.segmentIndex !== nextHoverTarget?.segmentIndex;

  if (!(didHoverPointChange || didHoverTargetChange)) {
    return false;
  }

  session.hoverPoint = {
    x: round(nextHoverPoint.x, 2),
    y: round(nextHoverPoint.y, 2),
  };
  session.hoverTarget = nextHoverTarget;
  tool.editor.notifyInteractionPreviewChanged();
  return true;
};

export const shouldCloseContour = (
  tool: PenTool,
  node,
  bbox,
  point,
  startPoint
) => {
  const startWorldPoint = getNodeWorldPoint(node, bbox, startPoint);
  const closeDistance =
    VECTOR_ANCHOR_INTERACTION_RADIUS_PX / Math.max(tool.editor.zoom || 1, 1);

  return (
    Math.hypot(point.x - startWorldPoint.x, point.y - startWorldPoint.y) <=
    closeDistance
  );
};
