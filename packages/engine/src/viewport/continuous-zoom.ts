// Continuous zoom: one pinch, wheel-zoom burst, or zoom-control scrub. While
// it is active the canvas may reuse already-rastered art (scaled) instead of
// re-rastering every frame; ending it asks for one exact render at the final
// camera. It is separate from the camera interaction that governs store
// publication: pans, discrete zoom stops, and editing never enter it.

export type ContinuousZoomOwner = "pinch" | "scrub" | "wheel";

export type ContinuousZoomEndReason =
  | "blur"
  | "discrete-zoom"
  | "edit"
  | "end"
  | "hidden"
  | "idle"
  | "pointer-down"
  | "unmount";

export interface ContinuousZoomSession {
  id: number;
  owner: ContinuousZoomOwner;
}

export interface ContinuousZoomState {
  active: ContinuousZoomSession | null;
  // Bumps once per ended session: the canvas renders exactly at the final
  // camera for each revision.
  exactRenderRevision: number;
  lastEndReason: ContinuousZoomEndReason | null;
  listeners: Set<() => void>;
  nextId: number;
}

export const createContinuousZoomState = (): ContinuousZoomState => ({
  active: null,
  exactRenderRevision: 0,
  lastEndReason: null,
  listeners: new Set(),
  nextId: 1,
});

// Starts (or continues, for the same owner) a continuous zoom and returns its
// token. Another owner's session ends first.
export const beginContinuousZoom = (
  state: ContinuousZoomState,
  owner: ContinuousZoomOwner
): ContinuousZoomSession => {
  if (state.active?.owner === owner) {
    return state.active;
  }

  if (state.active) {
    endContinuousZoom(state, state.active, "end");
  }

  const session = { id: state.nextId, owner };

  state.nextId += 1;
  state.active = session;
  notify(state);

  return session;
};

// Ends the given session. A stale token (an old wheel timeout after a newer
// scrub began) is ignored.
export const endContinuousZoom = (
  state: ContinuousZoomState,
  session: ContinuousZoomSession | null,
  reason: ContinuousZoomEndReason
) => {
  if (!(session && state.active?.id === session.id)) {
    return false;
  }

  state.active = null;
  state.exactRenderRevision += 1;
  state.lastEndReason = reason;
  notify(state);

  return true;
};

// Ends whatever session is active: blur, tab hide, unmount, pointer-down,
// edits, and discrete zoom commands.
export const interruptContinuousZoom = (
  state: ContinuousZoomState,
  reason: ContinuousZoomEndReason
) => {
  return endContinuousZoom(state, state.active, reason);
};

export const subscribeContinuousZoom = (
  state: ContinuousZoomState,
  listener: () => void
) => {
  state.listeners.add(listener);

  return () => {
    state.listeners.delete(listener);
  };
};

// Store changes that edit the document or enter an edit end reuse; camera,
// hover, and other presentation-only writes do not.
export const isEditingStoreChange = (state, previousState) => {
  return (
    state.nodes !== previousState.nodes ||
    state.editingNodeId !== previousState.editingNodeId ||
    state.pathEditingNodeId !== previousState.pathEditingNodeId ||
    state.focusedGroupId !== previousState.focusedGroupId ||
    state.activeTool !== previousState.activeTool
  );
};

const notify = (state: ContinuousZoomState) => {
  for (const listener of state.listeners) {
    listener();
  }
};
