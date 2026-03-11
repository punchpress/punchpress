import { getBounds, translateContours } from "../../primitives/path-geometry";
import { layoutGlyphs } from "./warp-engine";

export const measureStraightText = (node, font) => {
  const layout = layoutGlyphs(node, font);
  const mergedContours: ReturnType<typeof translateContours> = [];

  for (const glyph of layout.glyphs) {
    mergedContours.push(...translateContours(glyph.contours, glyph.baseX, 0));
  }

  if (mergedContours.length === 0) {
    return {
      minX: -40,
      minY: -20,
      maxX: 40,
      maxY: 20,
      width: 80,
      height: 40,
    };
  }

  return getBounds(mergedContours);
};
