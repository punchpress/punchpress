import type { DropShadowDocument, EffectDocument } from "@punchpress/punch-schema";

export type Effect = EffectDocument;
export type DropShadow = DropShadowDocument;

const NO_EFFECTS: readonly Effect[] = [];

// Node kinds that own an effects stack. Paths inside a vector never do: the
// vector owns the object's shadow so children never shadow their siblings.
const EFFECT_OWNER_TYPES = new Set(["group", "path", "shape", "text", "vector"]);

export const getNodeEffects = (node): readonly Effect[] => {
  return node?.effects ?? NO_EFFECTS;
};

export const canOwnEffects = (node, parent) => {
  return Boolean(
    node &&
      EFFECT_OWNER_TYPES.has(node.type) &&
      !(node.type === "path" && parent?.type === "vector")
  );
};

// New shadows are hard: 8/8 black at full opacity, no blur.
export const createDropShadow = (id: string): DropShadow => ({
  blur: 0,
  color: "#000000",
  enabled: true,
  id,
  kind: "drop-shadow",
  opacity: 1,
  x: 8,
  y: 8,
});

export const createEffectId = (effects: readonly Effect[]) => {
  const ids = new Set(effects.map((effect) => effect.id));
  let index = effects.length + 1;

  while (ids.has(`shadow-${index}`)) {
    index += 1;
  }

  return `shadow-${index}`;
};
