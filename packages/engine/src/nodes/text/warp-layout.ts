import { commandsToContours, getBounds } from "../../primitives/path-geometry";
import { resolveTrackingPx } from "./tracking";

export const estimateBounds = (node) => {
  const halfWidth = Math.max(
    120,
    node.fontSize * Math.max(1, node.text.length * 0.28)
  );
  const halfHeight = Math.max(20, node.fontSize * 0.7);

  return {
    minX: -halfWidth,
    minY: -halfHeight,
    maxX: halfWidth,
    maxY: halfHeight,
    width: halfWidth * 2,
    height: halfHeight * 2,
  };
};

export const inflateBounds = (bbox, amount) => {
  return {
    minX: bbox.minX - amount,
    minY: bbox.minY - amount,
    maxX: bbox.maxX + amount,
    maxY: bbox.maxY + amount,
    width: bbox.width + amount * 2,
    height: bbox.height + amount * 2,
  };
};

export const layoutGlyphs = (node, font) => {
  const text = node.text.length > 0 ? [...node.text] : [" "];
  const scale = node.fontSize / font.unitsPerEm;

  const glyphs =
    /** @type {Array<{ advance: number, baseX: number, bounds: ReturnType<typeof getBounds>, centerX: number, char: string, contours: ReturnType<typeof commandsToContours>, path: string }>} */ ([]);
  const naturalGlyphCenters = /** @type {number[]} */ ([]);
  let naturalCursorX = 0;

  for (const char of text) {
    const glyph = font.charToGlyph(char);
    const path = glyph.getPath(0, 0, node.fontSize);
    const contours = commandsToContours(path.commands, 1);
    const bounds = getBounds(contours);
    const naturalAdvance = (glyph.advanceWidth || font.unitsPerEm) * scale;
    const centerX =
      bounds.width > 0 ? (bounds.minX + bounds.maxX) / 2 : naturalAdvance / 2;

    glyphs.push({
      path: path.toPathData(3),
      char,
      contours,
      bounds,
      advance: naturalAdvance,
      baseX: naturalCursorX,
      centerX,
    });
    naturalGlyphCenters.push(naturalCursorX + centerX);
    naturalCursorX += naturalAdvance;
  }

  const naturalTotalWidth = Math.max(naturalCursorX, 0);
  const naturalCenteringOffset = -naturalTotalWidth / 2;

  for (let index = 0; index < glyphs.length; index += 1) {
    const glyph = glyphs[index];
    if (!glyph) {
      continue;
    }

    glyph.baseX += naturalCenteringOffset;
    naturalGlyphCenters[index] =
      (naturalGlyphCenters[index] ?? glyph.centerX) + naturalCenteringOffset;
  }

  const appliedTracking = resolveTrackingPx(node.tracking, node.fontSize);
  const trackedGlyphCenters = naturalGlyphCenters.slice();

  for (let index = 1; index < trackedGlyphCenters.length; index += 1) {
    const naturalGap =
      (naturalGlyphCenters[index] ?? 0) - (naturalGlyphCenters[index - 1] ?? 0);
    const previousCenter = trackedGlyphCenters[index - 1] ?? 0;

    trackedGlyphCenters[index] =
      previousCenter + Math.max(0, naturalGap + appliedTracking);
  }

  const centerOrigin =
    trackedGlyphCenters.length > 0
      ? ((trackedGlyphCenters[0] ?? 0) + (trackedGlyphCenters.at(-1) ?? 0)) / 2
      : 0;

  for (const [index, glyph] of glyphs.entries()) {
    glyph.baseX =
      (trackedGlyphCenters[index] ?? 0) - centerOrigin - glyph.centerX;
  }

  const minX =
    glyphs.length > 0 ? Math.min(...glyphs.map((glyph) => glyph.baseX)) : 0;
  const maxX =
    glyphs.length > 0
      ? Math.max(...glyphs.map((glyph) => glyph.baseX + glyph.advance))
      : 0;
  const totalWidth = Math.max(maxX - minX, 0);

  return {
    glyphs,
    naturalGlyphCenters,
    naturalTotalWidth,
    appliedTracking,
    totalWidth,
  };
};
