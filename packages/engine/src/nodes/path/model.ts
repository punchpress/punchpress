import {
  DEFAULT_VECTOR_STROKE_LINE_CAP,
  DEFAULT_VECTOR_STROKE_LINE_JOIN,
  DEFAULT_VECTOR_STROKE_MITER_LIMIT,
} from "@punchpress/punch-schema";
import { createId } from "../text/model";
import { withPathNodeContours } from "./path-contours";

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

export const createDefaultPathNode = (parentId: string) => {
  const contours = [
    {
      closed: true,
      segments: createRectangleSegments(),
    },
  ];

  return withPathNodeContours(
    {
      fill: "#ffffff",
      fillRule: "evenodd",
      id: createId(),
      opacity: 1,
      parentId,
      stroke: "#000000",
      strokeLineCap: DEFAULT_VECTOR_STROKE_LINE_CAP,
      strokeLineJoin: DEFAULT_VECTOR_STROKE_LINE_JOIN,
      strokeMiterLimit: DEFAULT_VECTOR_STROKE_MITER_LIMIT,
      strokeWidth: DEFAULT_PATH_STROKE_WIDTH,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 2250,
        y: 2700,
      },
      type: "path",
      visible: true,
    },
    contours
  );
};
