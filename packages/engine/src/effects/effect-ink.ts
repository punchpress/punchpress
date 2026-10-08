import type { Appearance, Bounds } from "../appearance/appearance-types";
import { getNodeAppearance } from "../appearance/node-appearance";

const inkByGeometry = new WeakMap<object, WeakMap<Appearance, Bounds>>();
const entryInkByGeometry = new WeakMap<object, Bounds>();

// Conservative ink of a leaf effect owner in its local coordinates: the
// geometry frame (which already holds the outside stroke reach) grown by what
// the frame leaves out, miter tips and square caps. Feeds filter regions, so
// erring large only costs filter area.
export const getLeafEffectInk = (node, geometry): Bounds | null => {
  const frame = geometry?.bbox;

  if (!frame) {
    return null;
  }

  // Vectors paint transformed children and compiled results; each entry
  // carries its own ink in the vector's space.
  const entryInk = (geometry.paths ?? [])
    .map((path) => path.ink)
    .filter(Boolean);

  if (entryInk.length > 0) {
    const cached = entryInkByGeometry.get(geometry);
    const ink = cached ?? unionInk([frame, ...entryInk]);

    entryInkByGeometry.set(geometry, ink);

    return ink;
  }

  const appearance = getNodeAppearance(node);
  let byAppearance = inkByGeometry.get(geometry);

  if (!byAppearance) {
    byAppearance = new WeakMap();
    inkByGeometry.set(geometry, byAppearance);
  }

  const cached = byAppearance.get(appearance);

  if (cached) {
    return cached;
  }

  const grow = appearance.strokes.reduce((extra, layer) => {
    if (!layer.enabled) {
      return extra;
    }

    // Aligned strokes paint up to w on one side, center strokes w/2.
    const reach = layer.align === "center" ? layer.width / 2 : layer.width;
    const joinExtra =
      layer.join === "miter" ? reach * (Math.max(1, layer.miterLimit) - 1) : 0;
    const capExtra = layer.cap === "square" ? reach * (Math.SQRT2 - 1) : 0;

    return Math.max(extra, joinExtra, capExtra);
  }, 0);
  const ink = {
    height: frame.height + grow * 2,
    maxX: frame.maxX + grow,
    maxY: frame.maxY + grow,
    minX: frame.minX - grow,
    minY: frame.minY - grow,
    width: frame.width + grow * 2,
  };

  byAppearance.set(appearance, ink);

  return ink;
};

const unionInk = (boxes: readonly Bounds[]): Bounds => {
  const minX = Math.min(...boxes.map((box) => box.minX));
  const minY = Math.min(...boxes.map((box) => box.minY));
  const maxX = Math.max(...boxes.map((box) => box.maxX));
  const maxY = Math.max(...boxes.map((box) => box.maxY));

  return { height: maxY - minY, maxX, maxY, minX, minY, width: maxX - minX };
};
