import { effectsSchema, MAX_EFFECTS, parseColor } from "@punchpress/punch-schema";
import { clamp } from "../primitives/math";
import {
  canOwnEffects,
  createDropShadow,
  createEffectId,
  type DropShadow,
  type Effect,
  getNodeEffects,
} from "./effect-model";

type EffectPatch = Partial<
  Pick<DropShadow, "blur" | "enabled" | "opacity" | "x" | "y">
> & {
  // A CSS color; its alpha is ignored (opacity is patched separately).
  color?: string;
};

const MAX_BLUR = 1000;
const MAX_OFFSET = 10_000;

// Effect commands target the nodes that own effects: a vector keeps its own
// effects (never its child paths), a path inside a vector routes to the
// vector, and groups own effects directly.
export const getEffectTargetNodeIds = (editor, nodeIds: string[]) => {
  const targets = nodeIds.flatMap((nodeId) => {
    const node = editor.getNode(nodeId);
    const parent = node ? editor.getNode(node.parentId) : null;

    if (node?.type === "path" && parent?.type === "vector") {
      return [parent.id];
    }

    return canOwnEffects(node, parent) ? [nodeId] : [];
  });

  return [...new Set(targets)];
};

export const addEffect = (
  editor,
  kind: Effect["kind"] = "drop-shadow",
  nodeIds = editor.selectedNodeIds
) => {
  return updateEffects(editor, nodeIds, (effects) => {
    if (kind !== "drop-shadow" || effects.length >= MAX_EFFECTS) {
      return null;
    }

    return [...effects, createDropShadow(createEffectId(effects))];
  });
};

export const updateEffect = (
  editor,
  index: number,
  patch: EffectPatch,
  nodeIds = editor.selectedNodeIds
) => {
  return updateEffects(editor, nodeIds, (effects) => {
    const effect = effects[index];
    const next = effect ? applyEffectPatch(effect, patch) : null;

    return next
      ? effects.map((current, at) => (at === index ? next : current))
      : null;
  });
};

export const removeEffect = (
  editor,
  index: number,
  nodeIds = editor.selectedNodeIds
) => {
  return updateEffects(editor, nodeIds, (effects) => {
    return effects[index]
      ? effects.filter((_effect, at) => at !== index)
      : null;
  });
};

export const moveEffect = (
  editor,
  index: number,
  toIndex: number,
  nodeIds = editor.selectedNodeIds
) => {
  return updateEffects(editor, nodeIds, (effects) => {
    if (!(effects[index] && effects[toIndex]) || index === toIndex) {
      return null;
    }

    const next = [...effects];
    const [effect] = next.splice(index, 1);

    next.splice(toIndex, 0, effect);

    return next;
  });
};

// Replaces whole effect stacks (resolving mixed stacks, automation). The
// input must validate.
export const setEffects = (
  editor,
  effects: readonly Effect[],
  nodeIds = editor.selectedNodeIds
) => {
  const result = effectsSchema.safeParse(effects);

  if (!result.success) {
    return false;
  }

  return updateEffects(editor, nodeIds, () => result.data);
};

// One history step for every target. Targets the update cannot apply to are
// left unchanged.
const updateEffects = (
  editor,
  nodeIds: string[],
  update: (effects: readonly Effect[]) => readonly Effect[] | null
) => {
  const nextById = new Map<string, readonly Effect[]>();

  for (const nodeId of getEffectTargetNodeIds(editor, nodeIds)) {
    const effects = getNodeEffects(editor.getNode(nodeId));
    const next = update(effects);

    if (next && next !== effects) {
      nextById.set(nodeId, next);
    }
  }

  if (nextById.size === 0) {
    return false;
  }

  editor.updateNodes([...nextById.keys()], (node) => {
    return { effects: nextById.get(node.id) };
  });

  return true;
};

const applyEffectPatch = (effect: Effect, patch: EffectPatch) => {
  const next = { ...effect };

  if (patch.color !== undefined) {
    const parsed = parseColor(patch.color);

    if (!parsed) {
      return null;
    }

    next.color = parsed.color;
  }

  if (typeof patch.enabled === "boolean") {
    next.enabled = patch.enabled;
  }

  if (Number.isFinite(patch.opacity)) {
    next.opacity = clamp(patch.opacity as number, 0, 1);
  }

  if (Number.isFinite(patch.blur)) {
    next.blur = clamp(patch.blur as number, 0, MAX_BLUR);
  }

  if (Number.isFinite(patch.x)) {
    next.x = clamp(patch.x as number, -MAX_OFFSET, MAX_OFFSET);
  }

  if (Number.isFinite(patch.y)) {
    next.y = clamp(patch.y as number, -MAX_OFFSET, MAX_OFFSET);
  }

  return next;
};
