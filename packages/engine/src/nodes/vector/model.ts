import {
  DEFAULT_VECTOR_STROKE_LINE_CAP,
  DEFAULT_VECTOR_STROKE_LINE_JOIN,
  DEFAULT_VECTOR_STROKE_MITER_LIMIT,
  ROOT_PARENT_ID,
} from "@punchpress/punch-schema";
import { createId } from "../text/model";

const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 180;
const DEFAULT_VECTOR_STROKE_WIDTH = 3;

const createRectangleContour = (
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT
) => {
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  return {
    closed: true,
    segments: [
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: -halfWidth, y: -halfHeight },
        pointType: "corner",
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: halfWidth, y: -halfHeight },
        pointType: "corner",
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: halfWidth, y: halfHeight },
        pointType: "corner",
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: -halfWidth, y: halfHeight },
        pointType: "corner",
      },
    ],
  };
};

export const createDefaultVectorNode = () => {
  return {
    contours: [createRectangleContour()],
    fill: "#ffffff",
    fillRule: "nonzero",
    id: createId(),
    parentId: ROOT_PARENT_ID,
    stroke: "#000000",
    strokeLineCap: DEFAULT_VECTOR_STROKE_LINE_CAP,
    strokeLineJoin: DEFAULT_VECTOR_STROKE_LINE_JOIN,
    strokeMiterLimit: DEFAULT_VECTOR_STROKE_MITER_LIMIT,
    strokeWidth: DEFAULT_VECTOR_STROKE_WIDTH,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 2250,
      y: 2700,
    },
    type: "vector",
    visible: true,
  };
};
