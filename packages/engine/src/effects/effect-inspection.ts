import { getEffectTargetNodeIds } from "./effect-commands";
import { type Effect, getNodeEffects } from "./effect-model";

export interface SelectionEffects {
  // The shared stack, or the first target's when stacks differ.
  effects: readonly Effect[];
  isMixed: boolean;
  targetCount: number;
}

interface CachedSelectionEffects {
  nodeIdList: readonly string[];
  nodeIdsKey: string;
  nodes: unknown;
  result: SelectionEffects;
}

// Effect owners depend only on the node tree, so one result serves every
// inspector read until the document or the selection changes.
const cacheByEditor = new WeakMap<object, CachedSelectionEffects>();

// The effects the panel shows for a selection. Stacks match when they are
// equal apart from internal ids; otherwise the selection reads as mixed.
export const getSelectionEffects = (
  editor,
  nodeIds: string[]
): SelectionEffects => {
  const nodes = editor.getState().nodes;
  const cached = cacheByEditor.get(editor);

  // Callers usually pass the stored selection array, so identity skips the
  // key on unrelated store updates.
  if (cached?.nodes === nodes && cached.nodeIdList === nodeIds) {
    return cached.result;
  }

  const nodeIdsKey = nodeIds.join("\0");

  if (cached?.nodes === nodes && cached.nodeIdsKey === nodeIdsKey) {
    cacheByEditor.set(editor, { ...cached, nodeIdList: nodeIds });
    return cached.result;
  }

  const result = buildSelectionEffects(editor, nodeIds);

  cacheByEditor.set(editor, {
    nodeIdList: nodeIds,
    nodeIdsKey,
    nodes,
    result,
  });

  return result;
};

// Effect ids of the shared stack in stored order. Empty when mixed.
export const getEffectIds = (editor, nodeIds: string[]): string[] => {
  const { effects, isMixed } = getSelectionEffects(editor, nodeIds);

  return isMixed ? [] : effects.map((effect) => effect.id);
};

// Resolves a row's effect id to its effect and current index in the shared
// stack. Commands address effects by index across every owner (ids differ
// between equal stacks), so controls resolve the index when they dispatch.
export const getEffect = (
  editor,
  effectId: string,
  nodeIds: string[]
): { effect: Effect; index: number } | null => {
  const { effects, isMixed } = getSelectionEffects(editor, nodeIds);
  const index = isMixed
    ? -1
    : effects.findIndex((effect) => effect.id === effectId);

  return index < 0 ? null : { effect: effects[index], index };
};

const buildSelectionEffects = (editor, nodeIds: string[]): SelectionEffects => {
  const stacks = getEffectTargetNodeIds(editor, nodeIds).map((nodeId) => {
    return getNodeEffects(editor.getNode(nodeId));
  });
  const [first = []] = stacks;

  return {
    effects: first,
    isMixed: stacks.some((stack) => !areEffectStacksEqual(stack, first)),
    targetCount: stacks.length,
  };
};

const areEffectStacksEqual = (
  a: readonly Effect[],
  b: readonly Effect[]
) => {
  return (
    a.length === b.length &&
    a.every((effect, index) => {
      const other = b[index];

      return (
        effect.kind === other.kind &&
        effect.enabled === other.enabled &&
        effect.color === other.color &&
        effect.opacity === other.opacity &&
        effect.x === other.x &&
        effect.y === other.y &&
        effect.blur === other.blur
      );
    })
  );
};
