import {
  createOpenVectorContour,
  reverseVectorContour,
} from "../nodes/vector/vector-contour-operations";
import { getSelectedEndpointContinuationTarget } from "./pen-existing-point-actions";
import type { PenTool } from "./pen-tool";
import { getContourSegmentCount } from "./pen-tool-types";

export const getActiveAuthoringSession = (tool: PenTool) => {
  const session = tool.authoringSession;

  if (!session) {
    return null;
  }

  const node = tool.editor.getNode(session.nodeId);

  if (
    node?.type !== "vector" ||
    node.contours[session.contourIndex]?.closed ||
    !node.contours[session.contourIndex]
  ) {
    tool.authoringSession = null;
    return null;
  }

  return session;
};

export const startSelectedEndpointContinuationSession = (tool: PenTool) => {
  const continuation = getSelectedEndpointContinuationTarget(tool.editor);

  if (!continuation) {
    return false;
  }

  return startContinuationSession(tool, continuation.node, continuation.target);
};

export const finishAuthoringSession = (
  tool: PenTool,
  { commit } = { commit: true }
) => {
  const session = tool.authoringSession;

  if (!session) {
    return false;
  }

  const node = tool.editor.getNode(session.nodeId);
  const shouldCommit =
    commit &&
    session.hasAuthoredChange &&
    getContourSegmentCount(node, session.contourIndex) >= 2;

  tool.authoringSession = null;
  tool.idleHoverTarget = null;
  tool.editor.setPathEditingPoint(null);
  tool.editor.notifyInteractionPreviewChanged();

  if (shouldCommit) {
    return tool.editor.commitHistoryStep(session.historyMark);
  }

  return tool.editor.revertToMark(session.historyMark);
};

export const startAuthoringSession = (tool: PenTool, point) => {
  const historyMark = tool.editor.markHistoryStep("draw vector path");

  if (!historyMark) {
    return false;
  }

  let nodeId: string | null = null;

  tool.editor.run(() => {
    if (tool.editor.pathEditingNodeId) {
      tool.editor.stopPathEditing();
    }

    nodeId = tool.editor.getState().addVectorNode(point, {
      activatePointer: false,
      patch: {
        contours: [createOpenVectorContour({ x: 0, y: 0 })],
      },
    });

    if (!nodeId) {
      return;
    }

    tool.editor.getState().setPathEditingNodeId(nodeId);
    tool.editor.getState().setPathEditingPoint({
      contourIndex: 0,
      segmentIndex: 0,
    });
  });

  if (!nodeId) {
    tool.editor.revertToMark(historyMark);
    return false;
  }

  tool.idleHoverTarget = null;
  tool.authoringSession = {
    contourIndex: 0,
    draft: null,
    hasAuthoredChange: false,
    hasPlacedInitialPoint: false,
    historyMark,
    hoverPoint: null,
    hoverTarget: null,
    nodeId,
  };
  tool.editor.notifyInteractionPreviewChanged();
  return true;
};

export const startContinuationSession = (tool: PenTool, node, target) => {
  const historyMark = tool.editor.markHistoryStep("continue vector path");

  if (!historyMark) {
    return false;
  }

  const contour = node.contours[target.contourIndex];

  if (!contour || contour.closed || contour.segments.length === 0) {
    tool.editor.revertToMark(historyMark);
    return false;
  }

  let continuationTarget = target;

  if (target.endpoint === "start") {
    tool.editor.updateVectorContours(
      node.id,
      reverseVectorContour(node.contours, target.contourIndex)
    );
    continuationTarget = {
      ...target,
      endpoint: "end",
      segmentIndex: contour.segments.length - 1,
    };
  }

  tool.editor.setPathEditingNodeId(node.id);
  tool.editor.setPathEditingPoint({
    contourIndex: continuationTarget.contourIndex,
    segmentIndex: continuationTarget.segmentIndex,
  });

  tool.idleHoverTarget = null;
  tool.authoringSession = {
    contourIndex: continuationTarget.contourIndex,
    draft: null,
    hasAuthoredChange: false,
    hasPlacedInitialPoint: true,
    historyMark,
    hoverPoint: null,
    hoverTarget: null,
    nodeId: node.id,
  };
  tool.editor.notifyInteractionPreviewChanged();
  return true;
};
