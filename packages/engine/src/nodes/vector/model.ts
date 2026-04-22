import {
  DEFAULT_VECTOR_STROKE_LINE_CAP,
  DEFAULT_VECTOR_STROKE_LINE_JOIN,
  DEFAULT_VECTOR_STROKE_MITER_LIMIT,
  ROOT_PARENT_ID,
} from "@punchpress/punch-schema";
import { createId } from "../text/model";

const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 180;
const DEFAULT_PATH_STROKE_WIDTH = 3;

const createRectangleSegments = (
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT
) => {
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  return [
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
  ];
};

export const createDefaultVectorContour = () => {
  return {
    closed: true,
    fill: "#ffffff",
    fillRule: "nonzero",
    id: createId(),
    segments: createRectangleSegments(),
    stroke: "#000000",
    strokeLineCap: DEFAULT_VECTOR_STROKE_LINE_CAP,
    strokeLineJoin: DEFAULT_VECTOR_STROKE_LINE_JOIN,
    strokeMiterLimit: DEFAULT_VECTOR_STROKE_MITER_LIMIT,
    strokeWidth: DEFAULT_PATH_STROKE_WIDTH,
    visible: true,
  };
};

export const createDefaultVectorNode = () => {
  return {
    compoundWrapper: false,
    contours: [createDefaultVectorContour()],
    id: createId(),
    name: "Vector",
    pathComposition: "independent",
    parentId: ROOT_PARENT_ID,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 0,
      y: 0,
    },
    type: "vector",
    visible: true,
  };
};
