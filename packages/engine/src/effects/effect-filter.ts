import type { SvgElement } from "../appearance/appearance-elements";
import type { Bounds } from "../appearance/appearance-types";
import { format } from "../primitives/math";
import type { Effect } from "./effect-model";

// What an effect owner composites through: its enabled shadows and the
// conservative ink (owner-local) that feeds them.
export interface EffectPresentation {
  effects: readonly Effect[];
  ink: Bounds;
}

const presentations = new WeakMap<
  readonly Effect[],
  WeakMap<Bounds, EffectPresentation | null>
>();

// The owner's effect presentation, or null when nothing would paint. Cached
// per (effects, ink) identity so renderers can memoize on it.
export const getEffectPresentation = (
  effects: readonly Effect[],
  ink: Bounds | null
): EffectPresentation | null => {
  if (!ink || effects.length === 0) {
    return null;
  }

  let byInk = presentations.get(effects);

  if (!byInk) {
    byInk = new WeakMap();
    presentations.set(effects, byInk);
  }

  if (byInk.has(ink)) {
    return byInk.get(ink) ?? null;
  }

  const active = effects.filter((effect) => {
    return effect.enabled && effect.opacity > 0;
  });
  const presentation = active.length > 0 ? { effects: active, ink } : null;

  byInk.set(ink, presentation);

  return presentation;
};

// One SVG filter graph per owner: every shadow branches from SourceAlpha
// (offset, optional blur, flood, composite) and merges in list order under
// SourceGraphic. Blur follows CSS box-shadow: stdDeviation = blur / 2. The
// region is the ink plus each shadow's offset ink grown by 4σ, in the owner's
// local coordinates.
export const buildEffectFilter = (
  { effects, ink }: EffectPresentation,
  id: string
): SvgElement => {
  const region = getEffectRegion(effects, ink);
  const primitives: SvgElement[] = [];

  for (const [index, effect] of effects.entries()) {
    const offset = `o${index}`;
    const source = effect.blur > 0 ? `b${index}` : offset;

    primitives.push({
      attributes: {
        dx: format(effect.x),
        dy: format(effect.y),
        in: "SourceAlpha",
        result: offset,
      },
      key: offset,
      tag: "feOffset",
    });

    if (effect.blur > 0) {
      primitives.push({
        attributes: {
          in: offset,
          result: source,
          stdDeviation: format(effect.blur / 2),
        },
        key: source,
        tag: "feGaussianBlur",
      });
    }

    primitives.push(
      {
        attributes: {
          "flood-color": effect.color,
          ...(effect.opacity < 1
            ? { "flood-opacity": format(effect.opacity) }
            : {}),
          result: `c${index}`,
        },
        key: `c${index}`,
        tag: "feFlood",
      },
      {
        attributes: {
          in: `c${index}`,
          in2: source,
          operator: "in",
          result: `s${index}`,
        },
        key: `s${index}`,
        tag: "feComposite",
      }
    );
  }

  primitives.push({
    attributes: {},
    children: [
      ...effects.map((_, index) => ({
        attributes: { in: `s${index}` },
        key: `m${index}`,
        tag: "feMergeNode" as const,
      })),
      { attributes: { in: "SourceGraphic" }, key: "source", tag: "feMergeNode" },
    ],
    key: "merge",
    tag: "feMerge",
  });

  return {
    attributes: {
      "color-interpolation-filters": "sRGB",
      filterUnits: "userSpaceOnUse",
      height: format(region.height),
      id,
      primitiveUnits: "userSpaceOnUse",
      width: format(region.width),
      x: format(region.minX),
      y: format(region.minY),
    },
    children: primitives,
    key: id,
    tag: "filter",
  };
};

// The owner's output ink: its own ink plus every shadow's support.
export const getEffectRegion = (
  effects: readonly Effect[],
  ink: Bounds
): Bounds => {
  let minX = ink.minX;
  let minY = ink.minY;
  let maxX = ink.maxX;
  let maxY = ink.maxY;

  for (const effect of effects) {
    // 4σ, plus a unit of slack for rounding the region to 2 decimals.
    const support = 4 * (effect.blur / 2) + 1;

    minX = Math.min(minX, ink.minX + effect.x - support);
    minY = Math.min(minY, ink.minY + effect.y - support);
    maxX = Math.max(maxX, ink.maxX + effect.x + support);
    maxY = Math.max(maxY, ink.maxY + effect.y + support);
  }

  return {
    height: maxY - minY,
    maxX,
    maxY,
    minX,
    minY,
    width: maxX - minX,
  };
};
