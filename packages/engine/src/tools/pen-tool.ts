import {
  getPenHoverState,
  getPenPreviewState,
} from "./pen-tool-authoring-preview";
import {
  finishAuthoringSession,
  getActiveAuthoringSession,
  startAuthoringSession,
  startContinuationSession,
  startSelectedEndpointContinuationSession,
} from "./pen-tool-authoring-session";
import {
  beginDraftPlacement,
  cancelDraftPlacement,
  completeDraftPlacement,
  updateDraftPlacement,
} from "./pen-tool-draft-placement";
import {
  handlePenCanvasPointerDown,
  startExistingPointAction,
} from "./pen-tool-existing-point-state";
import {
  clearIdleHoverTarget,
  handlePenCanvasPointerLeave,
  handlePenCanvasPointerMove,
} from "./pen-tool-idle-state";
import type { PenAuthoringSession, PenHoverState } from "./pen-tool-types";
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
    return getPenPreviewState(this);
  }

  getHoverState() {
    return getPenHoverState(this);
  }

  hasActiveSession() {
    return Boolean(getActiveAuthoringSession(this));
  }

  onCanvasPointerDown(info) {
    return handlePenCanvasPointerDown(this, info);
  }

  onNodePointerDown({ event, node, point }) {
    if (point && !this.hasActiveSession()) {
      const existingPointAction = startExistingPointAction(
        this,
        point,
        node,
        event
      );

      if (existingPointAction) {
        return existingPointAction;
      }
    }

    return super.onNodePointerDown({ node, point });
  }

  onCanvasPointerLeave() {
    return handlePenCanvasPointerLeave(this);
  }

  onCanvasPointerMove(info) {
    return handlePenCanvasPointerMove(this, info);
  }

  onActivate() {
    return startSelectedEndpointContinuationSession(this);
  }

  onDeactivate() {
    const didFinish = finishAuthoringSession(this, { commit: true });
    const didClearIdleHover = clearIdleHoverTarget(this);

    return didFinish || didClearIdleHover;
  }

  onPathEditingStopped() {
    return finishAuthoringSession(this, { commit: true });
  }

  onKeyDown({ event, key }) {
    if (key === "escape" || key === "enter") {
      if (this.hasActiveSession()) {
        finishAuthoringSession(this, { commit: true });
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
    return beginDraftPlacement(this, session, point);
  }

  cancelDraftPlacement() {
    return cancelDraftPlacement(this);
  }

  completeDraftPlacement(point, options = {}) {
    return completeDraftPlacement(this, point, options);
  }

  finishAuthoringSession(options = { commit: true }) {
    return finishAuthoringSession(this, options);
  }

  startSelectedEndpointContinuationSession() {
    return startSelectedEndpointContinuationSession(this);
  }

  startAuthoringSession(point) {
    return startAuthoringSession(this, point);
  }

  startContinuationSession(node, target) {
    return startContinuationSession(this, node, target);
  }

  clearIdleHoverTarget() {
    return clearIdleHoverTarget(this);
  }

  updateDraftPlacement(point, options = {}) {
    return updateDraftPlacement(this, point, options);
  }
}
