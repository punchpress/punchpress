import type { Appearance } from "./appearance-types";
import { getNodeAppearance } from "./node-appearance";

export interface PaintExtent {
  filled: boolean;
  // How far enabled strokes reach into and out of the shape, in node-local
  // units: a center stroke reaches w/2 each way, an inside stroke w inward, an
  // outside stroke w outward. The selection frame grows by `outsideReach`.
  insideReach: number;
  outsideReach: number;
}

const alignedExtents = new WeakMap<Appearance, PaintExtent>();
const centeredExtents = new WeakMap<Appearance, PaintExtent>();

// The only appearance facts geometry may depend on: whether any fill paints
// (hit testing) and how far strokes reach on each side (bounds and hit
// distance). Colors, opacity, and layer order never reach geometry, so editing
// them reuses cached geometry and compiled vector surfaces. `alignable` is
// false for geometry with no closed contour, whose strokes all paint on
// center.
export const getPaintExtent = (node, alignable = true): PaintExtent => {
  const appearance = getNodeAppearance(node);
  const cache = alignable ? alignedExtents : centeredExtents;
  const cached = cache.get(appearance);

  if (cached) {
    return cached;
  }

  const extent = {
    filled: appearance.fills.some((layer) => layer.enabled),
    insideReach: 0,
    outsideReach: 0,
  };

  for (const layer of appearance.strokes) {
    if (!layer.enabled) {
      continue;
    }

    const align = alignable ? layer.align : "center";
    const inside =
      align === "center"
        ? layer.width / 2
        : align === "inside"
          ? layer.width
          : 0;
    const outside =
      align === "center"
        ? layer.width / 2
        : align === "outside"
          ? layer.width
          : 0;

    extent.insideReach = Math.max(extent.insideReach, inside);
    extent.outsideReach = Math.max(extent.outsideReach, outside);
  }

  cache.set(appearance, extent);

  return extent;
};

// Inputs for createPaintedHitRegion, which only tests presence and reach. A
// node with no enabled paint hit-tests by its geometry area so it can never
// become unselectable.
export const getPaintHitStyle = (node, alignable = true) => {
  const { filled, insideReach, outsideReach } = getPaintExtent(node, alignable);
  const stroked = insideReach > 0 || outsideReach > 0;

  return {
    fill: filled || !stroked ? "paint" : null,
    insideReach,
    outsideReach,
    stroke: stroked ? "paint" : null,
  };
};

export const getPaintSignature = (node, alignable = true) => {
  const { filled, insideReach, outsideReach } = getPaintExtent(node, alignable);

  return `${filled ? 1 : 0}:${insideReach}:${outsideReach}`;
};
