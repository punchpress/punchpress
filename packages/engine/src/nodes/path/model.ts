import { createSolidAppearance } from "../../appearance/appearance-layers";
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
      appearance: createSolidAppearance({
        fill: "#ffffff",
        stroke: "#000000",
        strokeWidth: DEFAULT_PATH_STROKE_WIDTH,
      }),
      fillRule: "evenodd",
      id: createId(),
      opacity: 1,
      parentId,
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
