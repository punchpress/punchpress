import {
  getExistingPointActionNode,
  resolveContinuationTarget,
  resolveDeletePointTarget,
  resolveInsertPointTarget,
  resolvePointTypeToggleTarget,
} from "./pen-existing-point-actions";
import type { PenTool } from "./pen-tool";
import {
  finishAuthoringSession,
  getActiveAuthoringSession,
  startAuthoringSession,
  startContinuationSession,
  startSelectedEndpointContinuationSession,
} from "./pen-tool-authoring-session";
import {
  beginDraftPlacement,
  updateDraftPlacement,
} from "./pen-tool-draft-placement";
import { startInsertPointAction } from "./pen-tool-insert-point-action";
import { startPointTypeToggleAction } from "./pen-tool-point-type-toggle-action";
import {
  createPlacementSession,
  DRAG_THRESHOLD_PX,
  isPenEditableNode,
} from "./pen-tool-types";

export const startExistingPointAction = (
  tool: PenTool,
  point,
  node = null,
  event = null
) => {
  const targetNode =
    (isPenEditableNode(node) ? node : null) ||
    getExistingPointActionNode(
      tool.editor,
      tool.editor.pathEditingNodeId || tool.editor.selectedNodeId
    );

  if (!targetNode) {
    return null;
  }

  const pointTypeToggleTarget = event?.altKey
    ? resolvePointTypeToggleTarget(tool.editor, targetNode, point)
    : null;

  if (pointTypeToggleTarget) {
    return startPointTypeToggleAction(
      tool,
      targetNode,
      pointTypeToggleTarget,
      point
    );
  }

  const continuationTarget = resolveContinuationTarget(
    tool.editor,
    targetNode,
    point
  );

  if (
    continuationTarget &&
    startContinuationSession(tool, targetNode, continuationTarget)
  ) {
    return createPlacementSession(
      () => finishAuthoringSession(tool, { commit: false }),
      () => true,
      () => false
    );
  }

  const deletePointTarget = resolveDeletePointTarget(
    tool.editor,
    targetNode,
    point
  );

  if (deletePointTarget) {
    return createPlacementSession(
      () => false,
      ({ dragDistancePx = 0 } = {}) =>
        completeDeletePointPlacement(
          tool,
          targetNode.id,
          deletePointTarget,
          dragDistancePx
        ),
      () => false
    );
  }

  const insertPointTarget = resolveInsertPointTarget(
    tool.editor,
    targetNode,
    point
  );

  if (!insertPointTarget) {
    return null;
  }

  return startInsertPointAction(tool, targetNode, insertPointTarget, point);
};

export const handlePenCanvasPointerDown = (tool: PenTool, { event, point }) => {
  if (!point) {
    return null;
  }

  let session = getActiveAuthoringSession(tool);

  if (!session) {
    const existingPointAction = startExistingPointAction(
      tool,
      point,
      null,
      event
    );

    if (existingPointAction) {
      return existingPointAction;
    }
  }

  const hasResumedSelectedEndpoint =
    session || startSelectedEndpointContinuationSession(tool);

  if (!(hasResumedSelectedEndpoint || startAuthoringSession(tool, point))) {
    return null;
  }

  if (!session) {
    session = tool.authoringSession;
  }

  if (!session) {
    return null;
  }

  beginDraftPlacement(tool, session, point);

  return createPlacementSession(
    () => tool.cancelDraftPlacement(),
    ({ point: nextPoint, ...options } = {}) =>
      tool.completeDraftPlacement(nextPoint || point, options),
    ({ point: nextPoint, ...options } = {}) =>
      updateDraftPlacement(tool, nextPoint || point, options)
  );
};

export const completeDeletePointPlacement = (
  tool: PenTool,
  nodeId,
  target,
  dragDistancePx
) => {
  if (dragDistancePx >= DRAG_THRESHOLD_PX) {
    return false;
  }

  const didDelete = tool.editor.deleteVectorPoint(nodeId, target);

  if (!didDelete) {
    return false;
  }

  tool.idleHoverTarget = null;
  tool.editor.notifyInteractionPreviewChanged();
  return true;
};
