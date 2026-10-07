import type { Appearance } from "./appearance-types";
import { getNodeAppearance } from "./node-appearance";

export interface PaintExtent {
  filled: boolean;
  // Widest enabled center stroke, in node-local units.
  strokeWidth: number;
}

const extentByAppearance = new WeakMap<Appearance, PaintExtent>();

// The only appearance facts geometry may depend on: whether any fill paints
// (hit testing) and the widest stroke (bounds and hit distance). Colors,
// opacity, and layer order never reach geometry, so editing them reuses
// cached geometry and compiled vector surfaces.
export const getPaintExtent = (node): PaintExtent => {
  const appearance = getNodeAppearance(node);
  const cached = extentByAppearance.get(appearance);

  if (cached) {
    return cached;
  }

  const extent = {
    filled: appearance.fills.some((layer) => layer.enabled),
    strokeWidth: appearance.strokes.reduce((width, layer) => {
      return layer.enabled ? Math.max(width, layer.width) : width;
    }, 0),
  };

  extentByAppearance.set(appearance, extent);

  return extent;
};

// Inputs for createPaintedHitRegion, which only tests presence and width. A
// node with no enabled paint hit-tests by its geometry area so it can never
// become unselectable.
export const getPaintHitStyle = (node) => {
  const { filled, strokeWidth } = getPaintExtent(node);

  return {
    fill: filled || strokeWidth === 0 ? "paint" : null,
    stroke: strokeWidth > 0 ? "paint" : null,
    strokeWidth,
  };
};

export const getPaintSignature = (node) => {
  const { filled, strokeWidth } = getPaintExtent(node);

  return `${filled ? 1 : 0}:${strokeWidth}`;
};
