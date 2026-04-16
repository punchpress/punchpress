import { isVectorNode } from "../nodes/node-tree";
import {
  createOpenVectorContour,
  reverseVectorContour,
} from "../nodes/vector/vector-contour-operations";
import { getSelectedEndpointContinuationTarget } from "./pen-existing-point-actions";
import type { PenTool } from "./pen-tool";
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

  if (shouldCommit) {
    return tool.editor.commitHistoryStep(session.historyMark);
  }

  return tool.editor.revertToMark(session.historyMark);
};

const getAppendTargetVectorId = (tool: PenTool) => {
  const pathEditingNode = tool.editor.pathEditingNodeId
    ? tool.editor.getNode(tool.editor.pathEditingNodeId)
    : null;
  const parentNodeId = pathEditingNode?.parentId || null;
  const parentNode = parentNodeId ? tool.editor.getNode(parentNodeId) : null;

  return isVectorNode(parentNode) ? parentNode.id : null;
};

export const startAuthoringSession = (tool: PenTool, point) => {
  const historyMark = tool.editor.markHistoryStep("draw vector path");

  if (!historyMark) {
    return false;
  }

  const appendTargetVectorId = getAppendTargetVectorId(tool);
  let parentNodeId: string | null = null;
  let nodeId: string | null = null;

  tool.editor.run(() => {
    if (appendTargetVectorId) {
      parentNodeId = appendTargetVectorId;
      nodeId = tool.editor.getState().addPathNode(appendTargetVectorId, point, {
        activatePointer: false,
        patch: {
          closed: false,
          segments: createOpenVectorContour({ x: 0, y: 0 }).segments,
        },
        selectionNodeId: appendTargetVectorId,
      });
      return;
    }

    if (tool.editor.pathEditingNodeId) {
      tool.editor.stopPathEditing();
    }

    parentNodeId = tool.editor.getState().addVectorNode(point, {
      activatePointer: false,
      patch: {
        path: {
          closed: false,
          segments: createOpenVectorContour({ x: 0, y: 0 }).segments,
        },
      },
    });
  });

  if (!(parentNodeId || nodeId)) {
    tool.editor.revertToMark(historyMark);
    return false;
  }

  const resolvedNodeId =
    nodeId ||
    (parentNodeId ? tool.editor.getChildNodeIds(parentNodeId)[0] : null);

  if (!resolvedNodeId) {
    tool.editor.revertToMark(historyMark);
    return false;
  }

  tool.editor.setPathEditingNodeId(resolvedNodeId);
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
    historyMark,
    hoverPoint: null,
    hoverTarget: null,
    nodeId: resolvedNodeId,
  };
  tool.editor.notifyInteractionPreviewChanged();
  return true;
};

export const startContinuationSession = (tool: PenTool, node, target) => {
  const historyMark = tool.editor.markHistoryStep("continue vector path");

  if (!historyMark) {
    return false;
  }

  const contour = getNodeContour(node, target.contourIndex);

  if (
    !(
      isPenEditableNode(node) &&
      contour &&
      !contour.closed &&
      contour.segments.length > 0
    )
  ) {
    tool.editor.revertToMark(historyMark);
    return false;
  }

  let continuationTarget = target;

  if (target.endpoint === "start") {
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
    historyMark,
    hoverPoint: null,
    hoverTarget: null,
    nodeId: node.id,
  };
  tool.editor.notifyInteractionPreviewChanged();
  return true;
};
