import { round } from "../primitives/math";
import { type Effect, getNodeEffects } from "./effect-model";

// When a resize or rotation bakes into a node's geometry (shape size, font
// size, a container's children) instead of its transform, its shadows must
// follow in the same commit: offsets scale and rotate as vectors, blur scales
// by the magnitude. Aggregate resize is uniform, so one blur value stays exact.

export const scaleEffects = (effects: readonly Effect[], scale: number) => {
  const magnitude = Math.abs(scale);

  return effects.map((effect) => ({
    ...effect,
    blur: round(effect.blur * magnitude, 2),
    x: round(effect.x * scale, 2),
    y: round(effect.y * scale, 2),
  }));
};

export const rotateEffects = (effects: readonly Effect[], degrees: number) => {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return effects.map((effect) => ({
    ...effect,
    x: round(effect.x * cos - effect.y * sin, 2),
    y: round(effect.x * sin + effect.y * cos, 2),
  }));
};

// The node's effects scaled for a baked resize, as a node-update fragment.
export const getScaledEffectsUpdate = (node, scale: number) => {
  const effects = getNodeEffects(node);

  return effects.length > 0 ? { effects: scaleEffects(effects, scale) } : {};
};

// Groups and child-backed vectors whose children receive a transform while the
// container itself does not: the requested containers and every container
// below them, minus nodes transformed directly. Returns base effect stacks.
export const getBakedEffectContainers = (
  editor,
  requestedNodeIds: readonly string[],
  transformedNodeIds: readonly string[]
) => {
  const transformed = new Set(transformedNodeIds);
  const containers = new Map<string, readonly Effect[]>();

  const visit = (nodeId: string) => {
    const node = editor.getNode(nodeId);

    if (!(node && (node.type === "group" || node.type === "vector"))) {
      return;
    }

    if (!transformed.has(nodeId) && getNodeEffects(node).length > 0) {
      containers.set(nodeId, getNodeEffects(node));
    }

    for (const childId of editor.getChildNodeIds(nodeId)) {
      visit(childId);
    }
  };

  for (const nodeId of requestedNodeIds) {
    visit(nodeId);
  }

  return containers;
};
