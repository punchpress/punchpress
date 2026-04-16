import { createId } from "../text/model";
import { ROOT_PARENT_ID } from "@punchpress/punch-schema";

export const createDefaultVectorNode = () => {
  return {
    id: createId(),
    name: "Vector",
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
