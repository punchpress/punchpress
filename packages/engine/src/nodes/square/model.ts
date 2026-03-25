import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { createId } from "../text/model";

export const createDefaultSquareNode = () => {
  return {
    fill: "#000000",
    id: createId(),
    parentId: ROOT_PARENT_ID,
    size: 220,
    stroke: null,
    strokeWidth: 0,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 2250,
      y: 2700,
    },
    type: "square",
    visible: true,
  };
};
