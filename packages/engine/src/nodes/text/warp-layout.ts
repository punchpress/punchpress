import { commandsToContours, getBounds } from "../../primitives/path-geometry";

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
  let cursorX = 0;

  const glyphs =
    /** @type {Array<{ advance: number, baseX: number, centerX: number, contours: ReturnType<typeof commandsToContours>, path: string }>} */ ([]);

  for (const char of text) {
    const glyph = font.charToGlyph(char);
    const path = glyph.getPath(0, 0, node.fontSize);
    const contours = commandsToContours(path.commands, 1);
    const bounds = getBounds(contours);
    const advance =
      (glyph.advanceWidth || font.unitsPerEm) * scale + node.tracking;
    const centerX =
      bounds.width > 0 ? (bounds.minX + bounds.maxX) / 2 : advance / 2;

    glyphs.push({
      path: path.toPathData(3),
      contours,
      advance,
      baseX: cursorX,
      centerX,
    });

    cursorX += advance;
  }

  const totalWidth = Math.max(cursorX - node.tracking, 0);
  const centeringOffset = -totalWidth / 2;

  for (const glyph of glyphs) {
    glyph.baseX += centeringOffset;
  }

  return {
    glyphs,
    totalWidth,
  };
};
