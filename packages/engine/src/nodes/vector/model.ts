import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { createId } from "../text/model";

const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 180;

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
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: halfWidth, y: -halfHeight },
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: halfWidth, y: halfHeight },
      },
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: { x: -halfWidth, y: halfHeight },
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
    strokeWidth: 12,
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
