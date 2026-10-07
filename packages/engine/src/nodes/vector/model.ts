import { createSolidAppearance } from "../../appearance/appearance-layers";
import {
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
    appearance: createSolidAppearance({
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: DEFAULT_PATH_STROKE_WIDTH,
    }),
    closed: true,
    fillRule: "nonzero",
    id: createId(),
    segments: createRectangleSegments(),
    visible: true,
  };
};

export const createDefaultVectorNode = () => {
  return {
    compoundWrapper: false,
    contours: [createDefaultVectorContour()],
    id: createId(),
    name: "Vector",
    opacity: 1,
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

export const createDefaultVectorContainerNode = () => {
  const vectorNode = createDefaultVectorNode();

  return Object.fromEntries(
    Object.entries(vectorNode).filter(([key]) => key !== "contours")
  );
};
