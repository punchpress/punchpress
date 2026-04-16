import { round } from "../primitives/math";
import type { PenTool } from "./pen-tool";
import { getActiveAuthoringSession } from "./pen-tool-authoring-session";
import {
  getNodeContour,
  type PenHoverState,
  roundHandle,
} from "./pen-tool-types";

export const getPenPreviewState = (tool: PenTool) => {
  const session = getActiveAuthoringSession(tool);

  if (!session) {
    return null;
  }

  if (session.draft?.kind === "next-point") {
    return {
      ...(session.draft.dragHandle
        ? {
            handleIn: roundHandle({
              x: -session.draft.dragHandle.x,
              y: -session.draft.dragHandle.y,
            }),
          }
        : null),
      contourIndex: session.contourIndex,
      kind: "segment",
      nodeId: session.nodeId,
      pointer: {
        x: round(session.draft.anchorLocalPoint.x, 2),
        y: round(session.draft.anchorLocalPoint.y, 2),
      },
      target: session.draft.target,
    };
  }

  if (!session.hoverPoint) {
    return null;
  }

  return {
    contourIndex: session.contourIndex,
    kind: "segment",
    nodeId: session.nodeId,
    pointer: {
      x: round(session.hoverPoint.x, 2),
      y: round(session.hoverPoint.y, 2),
    },
    target: session.hoverTarget,
  };
};

export const getPenHoverState = (tool: PenTool) => {
  const session = getActiveAuthoringSession(tool);

  if (session?.hoverTarget?.type === "start-anchor") {
    const node = tool.editor.getNode(session.nodeId);
    const contour = getNodeContour(node, session.contourIndex);
    const point = contour?.segments[session.hoverTarget.segmentIndex]?.point;

    if (!point) {
      return null;
    }

    return {
      contourIndex: session.contourIndex,
      intent: "close",
      nodeId: session.nodeId,
      point: {
        x: round(point.x, 2),
        y: round(point.y, 2),
      },
      role: "anchor",
      segmentIndex: session.hoverTarget.segmentIndex,
    } satisfies PenHoverState;
  }

  return tool.idleHoverTarget;
};
