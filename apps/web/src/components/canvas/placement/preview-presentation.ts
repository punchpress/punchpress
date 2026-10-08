import {
  incrementPerfCounter,
  PERF_COUNTERS,
  type PreviewPresentationPlan,
  type PreviewTarget,
} from "@punchpress/engine";
import type { PlacementState } from "./durable-placement";
import { getPresentationElement } from "./presentation-elements";
import { applyShellPreview, getShellPreviewKey } from "./shell-preview";
import {
  getNodeShellState,
  getPlacementElements,
  type NodeShellState,
  type PlacementElements,
} from "./shell-state";

interface ShellEntry {
  elements: PlacementElements;
  nodeId: string;
  shellState: NodeShellState;
}

// One gesture's moving presentation roots, captured when the gesture begins
// and kept until it hands off, so cancel and commit reset exactly the
// elements that moved even if the tree changes underneath. Targets whose
// elements have not mounted yet (an alt-drag copy) join once they do.
export interface PreviewSession {
  lastKey: string | null;
  layers: HTMLElement[];
  pending: PreviewTarget[];
  plan: PreviewPresentationPlan;
  shellNodeIds: Set<string>;
  shells: ShellEntry[];
}

export const beginPreviewSession = (
  plan: PreviewPresentationPlan
): PreviewSession => {
  incrementPerfCounter(
    PERF_COUNTERS.renderPlacementPreviewRoots,
    plan.targets.length
  );

  return {
    lastKey: null,
    layers: [],
    pending: [...plan.targets],
    plan,
    shellNodeIds: new Set(
      plan.targets
        .filter((target) => target.kind !== "layer")
        .map((target) => target.nodeId)
    ),
    shells: [],
  };
};

// Writes the preview to the moving roots only. A layer root takes a single
// translation; its descendants' transforms and filters stay untouched.
export const applyPreviewSession = (
  editor,
  session: PreviewSession,
  preview,
  placementState: PlacementState
) => {
  const key = getShellPreviewKey(preview);
  const joined = session.pending.length
    ? joinPendingTargets(editor, session, placementState)
    : false;

  if (session.lastKey === key && !joined) {
    return false;
  }

  const delta = preview.delta || { x: 0, y: 0 };
  const translate = `translate(${delta.x || 0}px, ${delta.y || 0}px)`;

  for (const element of session.layers) {
    element.style.transform = translate;
  }

  for (const entry of session.shells) {
    applyShellPreview(entry.elements, entry.shellState, preview);
  }

  session.lastKey = key;
  incrementPerfCounter(
    PERF_COUNTERS.renderPlacementPreviewWrites,
    session.layers.length + session.shells.length
  );

  return true;
};

// Clears layer translations and promotion. The caller writes durable
// placement in the same pre-paint step, so committed and preview placement
// never show together.
export const endPreviewSession = (session: PreviewSession) => {
  for (const element of session.layers) {
    element.style.transform = "";
    element.style.willChange = "";
  }

  for (const { elements } of session.shells) {
    elements.shellElement.style.willChange = "";
  }
};

// Promotes each moving root once for the gesture. Descendants keep their
// idle styles: a moving layer carries them in its own coordinate space.
const joinPendingTargets = (
  editor,
  session: PreviewSession,
  placementState: PlacementState
) => {
  const pending: PreviewTarget[] = [];

  for (const target of session.pending) {
    if (target.kind === "layer") {
      const element = getPresentationElement(editor, target.nodeId);

      if (element) {
        element.style.willChange = "transform";
        session.layers.push(element);
      } else {
        pending.push(target);
      }

      continue;
    }

    const elements = getPlacementElements(editor, target.nodeId);
    const shellState =
      placementState.shellStates.get(target.nodeId) ||
      getNodeShellState(editor, target.nodeId);

    if (elements && shellState) {
      elements.shellElement.style.willChange = "transform";
      session.shells.push({ elements, nodeId: target.nodeId, shellState });
    } else {
      pending.push(target);
    }
  }

  const joined = pending.length < session.pending.length;

  session.pending = pending;

  return joined;
};
