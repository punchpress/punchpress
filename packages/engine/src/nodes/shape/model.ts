import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { createId } from "../text/model";

const SHAPE_DEFAULTS = {
  ellipse: {
    height: 180,
    width: 240,
  },
  polygon: {
    height: 180,
    width: 280,
  },
  star: {
    height: 240,
    width: 240,
  },
};

export const createDefaultShapeNode = (shape = "polygon") => {
  const size = SHAPE_DEFAULTS[shape] || SHAPE_DEFAULTS.polygon;

  return {
    cornerRadii: undefined,
    cornerRadius: 0,
    fill: "#000000",
    height: size.height,
    id: createId(),
    parentId: ROOT_PARENT_ID,
    points: undefined,
    shape,
    stroke: null,
    strokeWidth: 0,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 2250,
      y: 2700,
    },
    type: "shape",
    visible: true,
    width: size.width,
  };
};
