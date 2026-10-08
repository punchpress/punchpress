import { getEffectTargetNodeIds } from "./effect-commands";
import { type Effect, getNodeEffects } from "./effect-model";

export interface SelectionEffects {
  // The shared stack, or the first target's when stacks differ.
  effects: readonly Effect[];
  isMixed: boolean;
  targetCount: number;
}

// The effects the panel shows for a selection. Stacks match when they are
// equal apart from internal ids; otherwise the selection reads as mixed.
export const getSelectionEffects = (
  editor,
  nodeIds: string[]
): SelectionEffects => {
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
