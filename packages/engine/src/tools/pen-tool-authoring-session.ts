import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { createDefaultVectorContour } from "../nodes/vector/model";
import {
  createOpenVectorContour,
  reverseVectorContour,
} from "../nodes/vector/vector-contour-operations";
import { getSelectedEndpointContinuationTarget } from "./pen-existing-point-actions";
import type { PenTool } from "./pen-tool";
import type { PenAuthoringSession } from "./pen-tool-types";
import {
  getContourSegmentCount,
  getNodeContour,
  getNodeContours,
  isPenEditableNode,
} from "./pen-tool-types";

export const getActiveAuthoringSession = (tool: PenTool) => {
  const session = tool.authoringSession;

  if (!session) {
    return null;
  }

  const node = tool.editor.getNode(session.nodeId);
  const contour = getNodeContour(node, session.contourIndex);

  if (!(isPenEditableNode(node) && contour && !contour.closed)) {
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

  if (shouldCommit && session.historyMark) {
    return tool.editor.commitHistoryStep(session.historyMark);
  }

  if (session.historyMark) {
    return tool.editor.revertToMark(session.historyMark);
  }

  if (getContourSegmentCount(node, session.contourIndex) < 2) {
    return tool.editor.undo();
  }

  return true;
};

export const ensureAuthoringHistoryStep = (
  tool: PenTool,
  session: PenAuthoringSession
) => {
  if (session.historyMark) {
    return true;
  }

  session.historyMark = tool.editor.markHistoryStep(session.historyName);
  return Boolean(session.historyMark);
};

export const commitAuthoringHistoryStep = (
  tool: PenTool,
  session: PenAuthoringSession
) => {
  if (!session.historyMark) {
    session.hasAuthoredChange = false;
    return true;
  }

  const didCommit = tool.editor.commitHistoryStep(session.historyMark);

  session.historyMark = null;
  session.hasAuthoredChange = false;
  return didCommit;
};

export const releaseAuthoringHistoryStep = (
  tool: PenTool,
  session: PenAuthoringSession
) => {
  if (!session.historyMark) {
    return true;
  }

  const didRevert = tool.editor.revertToMark(session.historyMark);

  session.historyMark = null;
  session.hasAuthoredChange = false;
  return didRevert;
};

export const syncAuthoringSessionAfterHistoryChange = (tool: PenTool) => {
  const session = tool.authoringSession;

  if (!session) {
    return false;
  }

  session.draft = null;
  session.hasAuthoredChange = false;
  session.historyMark = null;
  session.hoverPoint = null;
  session.hoverTarget = null;

  const node = tool.editor.getNode(session.nodeId);
  const contour = getNodeContour(node, session.contourIndex);

  if (!(isPenEditableNode(node) && contour && !contour.closed)) {
    tool.authoringSession = null;
    tool.idleHoverTarget = null;
    tool.editor.getState().setActiveTool("pen");
    tool.editor.setPathEditingNodeId(null);
    tool.editor.setPathEditingPoint(null);
    tool.editor.notifyInteractionPreviewChanged();
    return true;
  }

  const lastSegmentIndex = contour.segments.length - 1;

  if (lastSegmentIndex < 0) {
    tool.authoringSession = null;
    tool.idleHoverTarget = null;
    tool.editor.getState().setActiveTool("pen");
    tool.editor.setPathEditingNodeId(null);
    tool.editor.setPathEditingPoint(null);
    tool.editor.notifyInteractionPreviewChanged();
    return true;
  }

  session.hasPlacedInitialPoint = true;
  tool.editor.getState().setActiveTool("pen");
  tool.editor.setPathEditingNodeId(session.nodeId);
  tool.editor.setPathEditingPoint({
    contourIndex: session.contourIndex,
    segmentIndex: lastSegmentIndex,
  });
  tool.editor.notifyInteractionPreviewChanged();
  return true;
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

    nodeId = tool.editor.getState().addPathNode(ROOT_PARENT_ID, point, {
      activatePointer: false,
      patch: {
        closed: false,
        segments: [
          {
            ...createDefaultVectorContour().segments[0],
            ...createOpenVectorContour({ x: 0, y: 0 }).segments[0],
          },
        ],
      },
    });
  });

  if (!nodeId) {
    tool.editor.revertToMark(historyMark);
    return false;
  }

  tool.editor.setPathEditingNodeId(nodeId);
  tool.editor.setPathEditingPoint({
    contourIndex: 0,
    segmentIndex: 0,
  });

  tool.idleHoverTarget = null;
  tool.authoringSession = {
    contourIndex: 0,
    draft: null,
    hasAuthoredChange: false,
    hasPlacedInitialPoint: false,
    historyName: "draw vector path",
    historyMark,
    hoverPoint: null,
    hoverTarget: null,
    nodeId,
  };
  tool.editor.notifyInteractionPreviewChanged();
  return true;
};

export const startContinuationSession = (tool: PenTool, node, target) => {
  const contour = getNodeContour(node, target.contourIndex);

  if (
    !(
      isPenEditableNode(node) &&
      contour &&
      !contour.closed &&
      contour.segments.length > 0
    )
  ) {
    return false;
  }

  let historyMark = null;
  let continuationTarget = target;

  if (target.endpoint === "start") {
    historyMark = tool.editor.markHistoryStep("continue vector path");

    if (!historyMark) {
      return false;
    }

    tool.editor.updateVectorContours(
      node.id,
      reverseVectorContour(getNodeContours(node), target.contourIndex)
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
    historyName: "continue vector path",
    historyMark,
    hoverPoint: null,
    hoverTarget: null,
    nodeId: node.id,
  };
  tool.editor.notifyInteractionPreviewChanged();
  return true;
};
