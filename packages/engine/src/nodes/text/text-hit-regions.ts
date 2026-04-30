import { createPaintedHitRegion } from "../../primitives/node-geometry";

const isWhitespaceGlyph = (char) => {
  return char.trim().length === 0;
};

export const getTextHitPadding = (node) => {
  return Math.max(8, Math.min(node.fontSize * 0.24, 24));
};

export const getBoundsContours = (bbox) => {
  return [
    {
      closed: true,
      points: [
        { x: bbox.minX, y: bbox.minY },
        { x: bbox.maxX, y: bbox.minY },
        { x: bbox.maxX, y: bbox.maxY },
        { x: bbox.minX, y: bbox.maxY },
      ],
    },
  ];
};

const createBridgeContour = (left, right, top, bottom) => {
  return {
    closed: true,
    points: [
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom },
    ],
  };
};

export const buildWordBridgeContours = (layout, node) => {
  const contours =
    /** @type {Array<{ closed: boolean, points: Array<{ x: number, y: number }> }>} */ ([]);
  const verticalPadding = getTextHitPadding(node) / 2;

  for (let index = 1; index < layout.glyphs.length; index += 1) {
    const leftGlyph = layout.glyphs[index - 1];
    const rightGlyph = layout.glyphs[index];

    if (!(leftGlyph && rightGlyph)) {
      continue;
    }

    if (
      isWhitespaceGlyph(leftGlyph.char) ||
      isWhitespaceGlyph(rightGlyph.char)
    ) {
      continue;
    }

    if (!(leftGlyph.bounds.width > 0 && rightGlyph.bounds.width > 0)) {
      continue;
    }

    const left = leftGlyph.baseX + leftGlyph.bounds.maxX;
    const right = rightGlyph.baseX + rightGlyph.bounds.minX;

    if (!(Number.isFinite(left) && Number.isFinite(right) && right > left)) {
      continue;
    }

    contours.push(
      createBridgeContour(
        left,
        right,
        Math.min(leftGlyph.bounds.minY, rightGlyph.bounds.minY) -
          verticalPadding,
        Math.max(leftGlyph.bounds.maxY, rightGlyph.bounds.maxY) +
          verticalPadding
      )
    );
  }

  return contours;
};

export const createTextHitRegions = (node, contours, bridgeContours = []) => {
  const hitRegions = [
    createPaintedHitRegion({
      contours,
      fill: node.fill,
      stroke: node.stroke,
      strokeWidth: node.strokeWidth,
    }),
  ];

  if (bridgeContours.length > 0) {
    hitRegions.push(
      createPaintedHitRegion({
        contours: bridgeContours,
        fill: "#000000",
      })
    );
  }

  if (contours.length > 0) {
    hitRegions.push(
      createPaintedHitRegion({
        contours,
        stroke: "#000000",
        strokeWidth: getTextHitPadding(node),
      })
    );
  }

  return hitRegions;
};
