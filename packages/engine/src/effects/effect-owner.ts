import type { SvgElement } from "../appearance/appearance-elements";
import {
  buildEffectFilter,
  type EffectPresentation,
  getEffectPresentation,
} from "./effect-filter";
import { getLeafEffectInk } from "./effect-ink";
import { getNodeEffects } from "./effect-model";

// The one place renderers learn how a leaf owner composites its effects:
// canvas shells, dense surfaces, the text-edit preview, and export all ask
// here, so they cannot disagree. `geometry` is whatever geometry the renderer
// paints (live preview geometry while editing).
export const getLeafEffectPresentation = (
  node,
  geometry
): EffectPresentation | null => {
  const effects = getNodeEffects(node);

  if (effects.length === 0) {
    return null;
  }

  return getEffectPresentation(effects, getLeafEffectInk(node, geometry));
};

// Wraps an owner's painted elements in its filter: the definition, then one
// group that applies it. Opacity belongs outside, so the shadow fades with the
// content. `ownerKey` must be unique within the allocator's document.
export const wrapEffectElements = (
  children: SvgElement[],
  presentation: EffectPresentation | null,
  makeId: (key: string) => string,
  ownerKey: string
): SvgElement[] => {
  if (!presentation) {
    return children;
  }

  const id = makeId(JSON.stringify(["filter", ownerKey]));

  return [
    {
      attributes: {},
      children: [buildEffectFilter(presentation, id)],
      key: `${id}-defs`,
      tag: "defs",
    },
    {
      attributes: { filter: `url(#${id})` },
      children,
      key: `${id}-owner`,
      tag: "g",
    },
  ];
};
