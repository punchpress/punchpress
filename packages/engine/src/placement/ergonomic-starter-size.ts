import { getTopmostArtboardAtPoint } from "../nodes/artboard/artboard-hit-test";
import { getViewportWorldBounds } from "../viewport/viewport-queries";

const SHAPE_WIDTH_RATIO = 0.2;
const TEXT_FONT_SIZE_RATIO = 0.08;
const TEXT_STROKE_RATIO = 0.03;
const RECTANGLE_ASPECT_RATIO = 0.64;
const ELLIPSE_ASPECT_RATIO = 0.74;
const STAR_ASPECT_RATIO = 1;

const roundToStep = (value, step = 10) => {
  return Math.max(step, Math.round(value / step) * step);
};

const getReferenceBounds = (editor, point) => {
  const artboard = getTopmostArtboardAtPoint(editor, point);
  const artboardBounds = artboard
    ? editor.getNodeRenderFrame(artboard.id)?.bounds
    : null;

  return artboardBounds || getViewportWorldBounds(editor);
};

const getShapeAspectRatio = (shape) => {
  if (shape === "ellipse") {
    return ELLIPSE_ASPECT_RATIO;
  }

  if (shape === "star") {
    return STAR_ASPECT_RATIO;
  }

  return RECTANGLE_ASPECT_RATIO;
};

export const getErgonomicShapePatch = (editor, point, shape = "polygon") => {
  const bounds = getReferenceBounds(editor, point);
  if (!bounds) {
    return null;
  }

  const width = roundToStep(bounds.width * SHAPE_WIDTH_RATIO);
  const height = roundToStep(width * getShapeAspectRatio(shape));

  return {
    height,
    width,
  };
};

export const getErgonomicTextPatch = (editor, point) => {
  const bounds = getReferenceBounds(editor, point);
  if (!bounds) {
    return null;
  }

  const fontSize = roundToStep(bounds.width * TEXT_FONT_SIZE_RATIO);

  return {
    fontSize,
    strokeWidth: Math.max(1, Math.round(fontSize * TEXT_STROKE_RATIO)),
  };
};
