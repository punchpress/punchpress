import { VECTOR_ANCHOR_INTERACTION_RADIUS_PX } from "../nodes/vector/interaction-constants";
import {
  appendPenContourSegment,
  closePenContour,
  createPenContour,
  replacePenContourSegment,
  reversePenContour,
} from "../nodes/vector/pen-authoring";
import { round } from "../primitives/math";
import { getNodeLocalPoint, getNodeWorldPoint } from "../primitives/rotation";
import {
  getExistingPointActionNode,
  getSelectedEndpointContinuationTarget,
  resolveContinuationTarget,
  resolveDeletePointTarget,
  resolveInsertPointTarget,
} from "./pen-existing-point-actions";
import {
  DRAG_THRESHOLD_PX,
  PEN_HANDLE_DRAG_THRESHOLD_PX,
  createPlacementSession,
  getContourSegmentCount,
  getZeroHandle,
  isSamePoint,
  roundHandle,
  type PenAuthoringSession,
  type PenDraftPlacement,
  type PenHoverState,
} from "./pen-tool-types";
import { selectToolFromShortcut, Tool } from "./tool";

export class PenTool extends Tool {
  authoringSession: PenAuthoringSession | null;
  idleHoverTarget: PenHoverState | null;

  constructor(editor) {
    super(editor);
    this.authoringSession = null;
    this.idleHoverTarget = null;
  }

  getPreviewState() {
    const session = this.getActiveAuthoringSession();

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
  }

  getHoverState() {
    const session = this.getActiveAuthoringSession();

    if (session?.hoverTarget?.type === "start-anchor") {
      return {
        contourIndex: session.contourIndex,
        intent: "close",
        nodeId: session.nodeId,
        role: "anchor",
        segmentIndex: session.hoverTarget.segmentIndex,
      } satisfies PenHoverState;
    }

    return this.idleHoverTarget;
  }

  hasActiveSession() {
    return Boolean(this.getActiveAuthoringSession());
  }

  onCanvasPointerDown({ point }) {
    if (!point) {
      return null;
    }

    let session = this.getActiveAuthoringSession();

    if (!session) {
      const existingPointAction = this.startExistingPointAction(point);

      if (existingPointAction) {
        return existingPointAction;
      }
    }

    const hasResumedSelectedEndpoint =
      session || this.startSelectedEndpointContinuationSession();

    if (!(hasResumedSelectedEndpoint || this.startAuthoringSession(point))) {
      return null;
    }

    if (!session) {
      session = this.getActiveAuthoringSession();
    }

    if (!session) {
      return null;
    }

    this.beginDraftPlacement(session, point);

    return createPlacementSession(
      () => this.cancelDraftPlacement(),
      ({ dragDistancePx = 0, point: nextPoint } = {}) =>
        this.completeDraftPlacement(nextPoint || point, dragDistancePx),
      ({ dragDistancePx = 0, point: nextPoint } = {}) =>
        this.updateDraftPlacement(nextPoint || point, dragDistancePx)
    );
  }

  getSelectedEndpointContinuationTarget() {
    return getSelectedEndpointContinuationTarget(this.editor);
  }

  startSelectedEndpointContinuationSession() {
    const continuation = this.getSelectedEndpointContinuationTarget();

    if (!continuation) {
      return false;
    }

    return this.startContinuationSession(
      continuation.node,
      continuation.target
    );
  }

  onNodePointerDown({ node, point }) {
    if (point && !this.hasActiveSession()) {
      const existingPointAction = this.startExistingPointAction(point, node);

      if (existingPointAction) {
        return existingPointAction;
      }
    }

    return super.onNodePointerDown({ node, point });
  }

  startExistingPointAction(point, node = null) {
    const targetNode =
      node ||
      this.getExistingPointActionNode(
        this.editor.pathEditingNodeId || this.editor.selectedNodeId
      );

    if (!targetNode) {
      return null;
    }

    const continuationTarget = this.resolveContinuationTarget(
      targetNode,
      point
    );

    if (
      continuationTarget &&
      this.startContinuationSession(targetNode, continuationTarget)
    ) {
      return createPlacementSession(
        () => this.finishAuthoringSession({ commit: false }),
        () => true,
        () => false
      );
    }

    const deletePointTarget = this.resolveDeletePointTarget(targetNode, point);

    if (deletePointTarget) {
      return createPlacementSession(
        () => false,
        ({ dragDistancePx = 0 } = {}) =>
          this.completeDeletePointPlacement(
            targetNode.id,
            deletePointTarget,
            dragDistancePx
          ),
        () => false
      );
    }

    const insertPointTarget = this.resolveInsertPointTarget(targetNode, point);

    if (!insertPointTarget) {
      return null;
    }

    return createPlacementSession(
      () => false,
      ({ dragDistancePx = 0 } = {}) =>
        this.completeInsertPointPlacement(
          targetNode.id,
          insertPointTarget,
          dragDistancePx
        ),
      () => false
    );
  }

  getExistingPointActionNode(nodeId) {
    return getExistingPointActionNode(this.editor, nodeId);
  }

  onCanvasPointerLeave() {
    const session = this.getActiveAuthoringSession();
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

    if (this.idleHoverTarget) {
      this.idleHoverTarget = null;
      didChange = true;
    }

    if (didChange) {
      this.editor.notifyInteractionPreviewChanged();
    }

    return didChange;
  }

  onCanvasPointerMove({ point }) {
    const session = this.getActiveAuthoringSession();

    if (!point) {
      return false;
    }

    if (session && !session.draft) {
      return this.setHoverPoint(session, point);
    }

    return this.setIdleHoverTarget(point);
  }

  onActivate() {
    return this.startSelectedEndpointContinuationSession();
  }

  onDeactivate() {
    const didFinish = this.finishAuthoringSession({ commit: true });
    const didClearIdleHover = this.clearIdleHoverTarget();

    return didFinish || didClearIdleHover;
  }

  onPathEditingStopped() {
    return this.finishAuthoringSession({ commit: true });
  }

  onKeyDown({ event, key }) {
    if (key === "escape" || key === "enter") {
      if (this.hasActiveSession()) {
        this.finishAuthoringSession({ commit: true });
        return true;
      }

      if (key === "escape") {
        this.editor.setActiveTool("pointer");
        return true;
      }
    }

    return selectToolFromShortcut(this.editor, key, event);
  }

  beginDraftPlacement(session, point) {
    const node = this.editor.getNode(session.nodeId);
    const bbox = this.editor.getNodeGeometry(session.nodeId)?.bbox;
    const contour =
      node?.type === "vector" ? node.contours[session.contourIndex] : null;

    if (!(node?.type === "vector" && bbox && contour)) {
      return;
    }

    const isFirstPoint = !session.hasPlacedInitialPoint;
    const anchorLocalPoint = isFirstPoint
      ? contour.segments[0]?.point || { x: 0, y: 0 }
      : getNodeLocalPoint(node, bbox, point);

    session.draft = {
      anchorCanvasPoint: {
        x: round(point.x, 2),
        y: round(point.y, 2),
      },
      anchorLocalPoint: {
        x: round(anchorLocalPoint.x, 2),
        y: round(anchorLocalPoint.y, 2),
      },
      dragHandle: null,
      kind: isFirstPoint ? "first-point" : "next-point",
      target: this.resolveCloseTarget(node, bbox, point, contour),
    };
    session.hoverPoint = null;
    session.hoverTarget = null;
    this.editor.notifyInteractionPreviewChanged();
  }

  cancelDraftPlacement() {
    const session = this.getActiveAuthoringSession();

    if (!session?.draft) {
      return false;
    }

    const draft = session.draft;
    session.draft = null;
    session.hoverPoint = null;
    session.hoverTarget = null;

    if (draft.kind === "first-point") {
      return this.finishAuthoringSession({ commit: false });
    }

    this.editor.notifyInteractionPreviewChanged();
    return true;
  }

  completeDraftPlacement(point, dragDistancePx) {
    const session = this.getActiveAuthoringSession();

    if (!(session?.draft && point)) {
      return false;
    }

    const node = this.editor.getNode(session.nodeId);
    const bbox = this.editor.getNodeGeometry(session.nodeId)?.bbox;
    const contour =
      node?.type === "vector" ? node.contours[session.contourIndex] : null;

    if (!(node?.type === "vector" && bbox && contour)) {
      return false;
    }

    this.updateDraftPlacement(point, dragDistancePx);

    const draft = session.draft;
    session.draft = null;

    if (draft.kind === "first-point") {
      session.hasPlacedInitialPoint = true;
      this.editor.notifyInteractionPreviewChanged();
      return true;
    }

    if (draft.target?.type === "start-anchor") {
      session.hasAuthoredChange = true;
      const nextContours = draft.dragHandle
        ? replacePenContourSegment(node.contours, {
            contourIndex: session.contourIndex,
            handleIn: roundHandle({
              x: -draft.dragHandle.x,
              y: -draft.dragHandle.y,
            }),
            pointType: "smooth",
            segmentIndex: draft.target.segmentIndex,
          })
        : node.contours;

      this.editor.updateVectorContours(
        node.id,
        closePenContour(nextContours, session.contourIndex)
      );
      this.editor.stopPathEditing();
      return true;
    }

    const nextPointType = draft.dragHandle ? "smooth" : "corner";

    session.hasAuthoredChange = true;
    this.editor.updateVectorContours(
      node.id,
      appendPenContourSegment(node.contours, {
        contourIndex: session.contourIndex,
        handleIn: draft.dragHandle
          ? roundHandle({
              x: -draft.dragHandle.x,
              y: -draft.dragHandle.y,
            })
          : getZeroHandle(),
        handleOut: draft.dragHandle
          ? roundHandle(draft.dragHandle)
          : getZeroHandle(),
        point: draft.anchorLocalPoint,
        pointType: nextPointType,
      }),
      {
        pinnedLocalPoint: draft.anchorLocalPoint,
        pinnedWorldPoint: draft.anchorCanvasPoint,
      }
    );
    this.editor.setPathEditingPoint({
      contourIndex: session.contourIndex,
      segmentIndex: contour.segments.length,
    });
    this.editor.notifyInteractionPreviewChanged();
    return true;
  }

  finishAuthoringSession({ commit } = { commit: true }) {
    const session = this.authoringSession;

    if (!session) {
      return false;
    }

    const node = this.editor.getNode(session.nodeId);
    const shouldCommit =
      commit &&
      session.hasAuthoredChange &&
      getContourSegmentCount(node, session.contourIndex) >= 2;

    this.authoringSession = null;
    this.idleHoverTarget = null;
    this.editor.setPathEditingPoint(null);
    this.editor.notifyInteractionPreviewChanged();

    if (shouldCommit) {
      return this.editor.commitHistoryStep(session.historyMark);
    }

    return this.editor.revertToMark(session.historyMark);
  }

  getActiveAuthoringSession() {
    const session = this.authoringSession;

    if (!session) {
      return null;
    }

    const node = this.editor.getNode(session.nodeId);

    if (
      node?.type !== "vector" ||
      node.contours[session.contourIndex]?.closed ||
      !node.contours[session.contourIndex]
    ) {
      this.authoringSession = null;
      return null;
    }

    return session;
  }

  resolveCloseTarget(node, bbox, point, contour) {
    const startPoint = contour.segments[0]?.point;

    if (
      !startPoint ||
      contour.segments.length < 2 ||
      !this.shouldCloseContour(node, bbox, point, startPoint)
    ) {
      return null;
    }

    return {
      segmentIndex: 0,
      type: "start-anchor",
    } as const;
  }

  setHoverPoint(session, point) {
    const node = this.editor.getNode(session.nodeId);
    const bbox = this.editor.getNodeGeometry(session.nodeId)?.bbox;
    const contour =
      node?.type === "vector" ? node.contours[session.contourIndex] : null;

    if (!(node?.type === "vector" && bbox && contour)) {
      return false;
    }

    const nextHoverPoint = getNodeLocalPoint(node, bbox, point);
    const nextHoverTarget = this.resolveCloseTarget(node, bbox, point, contour);
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
    this.editor.notifyInteractionPreviewChanged();
    return true;
  }

  setIdleHoverTarget(point) {
    const nodeId = this.editor.pathEditingNodeId || this.editor.selectedNodeId;
    const node = nodeId ? this.editor.getNode(nodeId) : null;
    const continuationTarget = this.resolveContinuationTarget(node, point);
    const deletePointTarget =
      continuationTarget || !node
        ? null
        : this.resolveDeletePointTarget(node, point);
    const insertPointTarget =
      continuationTarget || deletePointTarget || !node
        ? null
        : this.resolveInsertPointTarget(node, point);
    let nextIdleHoverTarget: PenHoverState | null = null;

    if (continuationTarget && node?.type === "vector") {
      nextIdleHoverTarget = {
        contourIndex: continuationTarget.contourIndex,
        intent: "continue" as const,
        nodeId: node.id,
        role: "anchor" as const,
        segmentIndex: continuationTarget.segmentIndex,
      };
    } else if (deletePointTarget && node?.type === "vector") {
      nextIdleHoverTarget = {
        contourIndex: deletePointTarget.contourIndex,
        intent: "delete" as const,
        nodeId: node.id,
        role: "anchor" as const,
        segmentIndex: deletePointTarget.segmentIndex,
      };
    } else if (insertPointTarget && node?.type === "vector") {
      nextIdleHoverTarget = {
        contourIndex: insertPointTarget.contourIndex,
        intent: "add" as const,
        nodeId: node.id,
        role: "segment" as const,
        segmentIndex: insertPointTarget.segmentIndex,
      };
    }

    const didChange =
      this.idleHoverTarget?.nodeId !== nextIdleHoverTarget?.nodeId ||
      this.idleHoverTarget?.contourIndex !==
        nextIdleHoverTarget?.contourIndex ||
      this.idleHoverTarget?.intent !== nextIdleHoverTarget?.intent ||
      this.idleHoverTarget?.role !== nextIdleHoverTarget?.role ||
      this.idleHoverTarget?.segmentIndex !== nextIdleHoverTarget?.segmentIndex;

    if (!didChange) {
      return false;
    }

    this.idleHoverTarget = nextIdleHoverTarget;
    this.editor.notifyInteractionPreviewChanged();
    return true;
  }

  completeDeletePointPlacement(nodeId, target, dragDistancePx) {
    if (dragDistancePx >= DRAG_THRESHOLD_PX) {
      return false;
    }

    const didDelete = this.editor.deleteVectorPoint(nodeId, target);

    if (!didDelete) {
      return false;
    }

    this.idleHoverTarget = null;
    this.editor.notifyInteractionPreviewChanged();
    return true;
  }

  completeInsertPointPlacement(nodeId, target, dragDistancePx) {
    if (dragDistancePx >= DRAG_THRESHOLD_PX) {
      return false;
    }

    const didInsert = this.editor.insertVectorPoint(target, nodeId);

    if (!didInsert) {
      return false;
    }

    this.idleHoverTarget = null;
    this.editor.notifyInteractionPreviewChanged();
    return true;
  }

  startAuthoringSession(point) {
    const historyMark = this.editor.markHistoryStep("draw vector path");

    if (!historyMark) {
      return false;
    }

    let nodeId: string | null = null;

    this.editor.run(() => {
      if (this.editor.pathEditingNodeId) {
        this.editor.stopPathEditing();
      }

      nodeId = this.editor.getState().addVectorNode(point, {
        activatePointer: false,
        patch: {
          contours: [createPenContour({ x: 0, y: 0 })],
        },
      });

      if (!nodeId) {
        return;
      }

      this.editor.getState().setPathEditingNodeId(nodeId);
      this.editor.getState().setPathEditingPoint({
        contourIndex: 0,
        segmentIndex: 0,
      });
    });

    if (!nodeId) {
      this.editor.revertToMark(historyMark);
      return false;
    }

    this.idleHoverTarget = null;
    this.authoringSession = {
      contourIndex: 0,
      draft: null,
      hasAuthoredChange: false,
      hasPlacedInitialPoint: false,
      historyMark,
      hoverPoint: null,
      hoverTarget: null,
      nodeId,
    };
    this.editor.notifyInteractionPreviewChanged();
    return true;
  }

  resolveContinuationTarget(node, point) {
    return resolveContinuationTarget(this.editor, node, point);
  }

  resolveDeletePointTarget(node, point) {
    return resolveDeletePointTarget(this.editor, node, point);
  }

  resolveInsertPointTarget(node, point) {
    return resolveInsertPointTarget(this.editor, node, point);
  }

  startContinuationSession(node, target) {
    const historyMark = this.editor.markHistoryStep("continue vector path");

    if (!historyMark) {
      return false;
    }

    const contour = node.contours[target.contourIndex];

    if (!contour || contour.closed || contour.segments.length === 0) {
      this.editor.revertToMark(historyMark);
      return false;
    }

    let continuationTarget = target;

    if (target.endpoint === "start") {
      this.editor.updateVectorContours(
        node.id,
        reversePenContour(node.contours, target.contourIndex)
      );
      continuationTarget = {
        ...target,
        endpoint: "end",
        segmentIndex: contour.segments.length - 1,
      };
    }

    this.editor.setPathEditingNodeId(node.id);
    this.editor.setPathEditingPoint({
      contourIndex: continuationTarget.contourIndex,
      segmentIndex: continuationTarget.segmentIndex,
    });

    this.idleHoverTarget = null;
    this.authoringSession = {
      contourIndex: continuationTarget.contourIndex,
      draft: null,
      hasAuthoredChange: false,
      hasPlacedInitialPoint: true,
      historyMark,
      hoverPoint: null,
      hoverTarget: null,
      nodeId: node.id,
    };
    this.editor.notifyInteractionPreviewChanged();
    return true;
  }

  clearIdleHoverTarget() {
    if (!this.idleHoverTarget) {
      return false;
    }

    this.idleHoverTarget = null;
    this.editor.notifyInteractionPreviewChanged();
    return true;
  }

  shouldCloseContour(node, bbox, point, startPoint) {
    const startWorldPoint = getNodeWorldPoint(node, bbox, startPoint);
    const closeDistance =
      VECTOR_ANCHOR_INTERACTION_RADIUS_PX / Math.max(this.editor.zoom || 1, 1);

    return (
      Math.hypot(point.x - startWorldPoint.x, point.y - startWorldPoint.y) <=
      closeDistance
    );
  }

  updateDraftPlacement(point, dragDistancePx) {
    const session = this.getActiveAuthoringSession();

    if (!(session?.draft && point)) {
      return false;
    }

    const node = this.editor.getNode(session.nodeId);
    const bbox = this.editor.getNodeGeometry(session.nodeId)?.bbox;
    const contour =
      node?.type === "vector" ? node.contours[session.contourIndex] : null;

    if (!(node?.type === "vector" && bbox && contour)) {
      return false;
    }

    const draft = session.draft;
    const isDragging = dragDistancePx >= PEN_HANDLE_DRAG_THRESHOLD_PX;

    if (draft.kind === "first-point") {
      const localPoint = getNodeLocalPoint(node, bbox, point);
      const nextHandle = isDragging
        ? roundHandle({
            x: localPoint.x - draft.anchorLocalPoint.x,
            y: localPoint.y - draft.anchorLocalPoint.y,
          })
        : null;

      draft.dragHandle = nextHandle;

      this.editor.updateVectorContours(
        node.id,
        replacePenContourSegment(node.contours, {
          contourIndex: session.contourIndex,
          handleIn: nextHandle
            ? {
                x: -nextHandle.x,
                y: -nextHandle.y,
              }
            : getZeroHandle(),
          handleOut: nextHandle || getZeroHandle(),
          pointType: nextHandle ? "smooth" : "corner",
          segmentIndex: 0,
        })
      );
      this.editor.notifyInteractionPreviewChanged();
      return true;
    }

    const localPoint = getNodeLocalPoint(node, bbox, point);

    draft.dragHandle = isDragging
      ? roundHandle({
          x: localPoint.x - draft.anchorLocalPoint.x,
          y: localPoint.y - draft.anchorLocalPoint.y,
        })
      : null;
    draft.target = this.resolveCloseTarget(
      node,
      bbox,
      draft.anchorCanvasPoint,
      contour
    );
    this.editor.notifyInteractionPreviewChanged();
    return true;
  }
}
