import type { EffectPresentation } from "@punchpress/engine";
import { toRgb } from "@punchpress/punch-schema";

// One group shadow as a CSS drop-shadow(), or null when the layer needs the
// branched SVG graph (several shadows; chained drop-shadow() would shadow the
// earlier shadows). CSS drop-shadow()'s length is the Gaussian standard
// deviation, while stored blur follows box-shadow (σ = blur / 2), as the SVG
// graph and export do.
export const getCssDropShadow = ({ effects }: EffectPresentation) => {
  if (effects.length !== 1) {
    return null;
  }

  const [{ blur, color, opacity, x, y }] = effects;
  const { b, g, r } = toRgb(color);

  return `drop-shadow(${x}px ${y}px ${blur / 2}px rgba(${r}, ${g}, ${b}, ${opacity}))`;
};
