import { parseColor, toRgb } from "@punchpress/punch-schema";
import { getNodeEffects } from "../effects/effect-model";

// Selection colors group paints by color *and* opacity, so a swatch's alpha is
// the exact layer, stop, or shadow opacity it stands for and editing it is
// lossless.
export const formatPaintValue = (color: string, opacity: number) => {
  if (opacity >= 1) {
    return color;
  }

  const { b, g, r } = toRgb(color);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Each enabled drop shadow's color, like a solid layer: the swatch carries
// the shadow opacity as alpha and writes back both.
export const getEffectColorFields = (node) => {
  return getNodeEffects(node)
    .filter((effect) => effect.enabled)
    .map((effect) => ({
      key: `effects.${effect.id}`,
      setValue: (currentNode, value) =>
        setEffectColor(currentNode, effect.id, value),
      value: formatPaintValue(effect.color, effect.opacity),
    }));
};

const setEffectColor = (node, effectId, value) => {
  const parsed = parseColor(value);

  if (!parsed) {
    return {};
  }

  return {
    effects: getNodeEffects(node).map((effect) => {
      return effect.id === effectId
        ? { ...effect, color: parsed.color, opacity: parsed.opacity }
        : effect;
    }),
  };
};
