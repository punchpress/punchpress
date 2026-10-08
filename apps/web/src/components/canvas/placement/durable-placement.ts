import {
  applyNodeShellState,
  getNodeShellState,
  getPlacementElements,
  getShellKey,
  type NodeShellState,
  type PlacementElements,
} from "./shell-state";

// What the canvas last wrote to each placed shell, so durable syncs touch
// only shells whose placement changed.
export interface PlacementState {
  appliedElements: Map<string, PlacementElements>;
  appliedKeys: Map<string, string>;
  shellStates: Map<string, NodeShellState | null>;
}

export const createPlacementState = (): PlacementState => ({
  appliedElements: new Map(),
  appliedKeys: new Map(),
  shellStates: new Map(),
});

// Shells a live gesture moves: its shell targets, and the shells carried by
// its moving layers.
interface MovingShells {
  plan: { movedPlacedNodeIds: ReadonlySet<string> };
  shellNodeIds: ReadonlySet<string>;
}

// Writes durable placement to every placed shell. During a gesture, shell
// targets keep their preview, and shells under a moving layer only receive
// their first placement (a copy mounting mid-drag), never an update beneath
// the still-active ancestor transform; the handoff writes the rest.
export const syncDurableNodeShells = (
  editor,
  placedNodeIds: readonly string[],
  placementState: PlacementState,
  moving: MovingShells | null
) => {
  pruneNodeShells(placedNodeIds, placementState);

  for (const nodeId of placedNodeIds) {
    const shellState = getNodeShellState(editor, nodeId);

    placementState.shellStates.set(nodeId, shellState);

    if (
      moving &&
      (moving.shellNodeIds.has(nodeId) ||
        (moving.plan.movedPlacedNodeIds.has(nodeId) &&
          placementState.appliedKeys.has(nodeId)))
    ) {
      continue;
    }

    syncNodeShell(editor, nodeId, shellState, placementState);
  }
};

// Marks shells a preview wrote, so the next durable sync rewrites them.
export const invalidateNodeShells = (
  nodeIds: Iterable<string>,
  placementState: PlacementState
) => {
  for (const nodeId of nodeIds) {
    placementState.appliedKeys.delete(nodeId);
  }
};

const syncNodeShell = (
  editor,
  nodeId: string,
  shellState: NodeShellState | null,
  { appliedElements, appliedKeys }: PlacementState
) => {
  const elements = getPlacementElements(editor, nodeId);

  if (!elements) {
    appliedElements.delete(nodeId);
    appliedKeys.delete(nodeId);
    return;
  }

  const nextKey = getShellKey(shellState);
  const previousElements = appliedElements.get(nodeId);

  if (
    appliedKeys.get(nodeId) === nextKey &&
    previousElements?.shellElement === elements.shellElement &&
    previousElements?.transformElement === elements.transformElement
  ) {
    return;
  }

  applyNodeShellState(elements, shellState);
  appliedElements.set(nodeId, elements);
  appliedKeys.set(nodeId, nextKey);
};

// Forgets placement for shells that left the placed list. Keys are checked
// against a set: placed lists hold thousands of shells in large imports.
const pruneNodeShells = (
  placedNodeIds: readonly string[],
  { appliedElements, appliedKeys, shellStates }: PlacementState
) => {
  const placedNodeIdSet = new Set(placedNodeIds);

  for (const nodeId of new Set([
    ...appliedKeys.keys(),
    ...shellStates.keys(),
  ])) {
    if (!placedNodeIdSet.has(nodeId)) {
      appliedElements.delete(nodeId);
      appliedKeys.delete(nodeId);
      shellStates.delete(nodeId);
    }
  }
};
