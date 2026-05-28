import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { createId } from "../text/model";

export const createDefaultImageNode = ({
  height = 240,
  mimeType = "image/png",
  name = "Image",
  src = "",
  width = 240,
} = {}) => {
  return {
    height,
    id: createId(),
    mimeType,
    name,
    opacity: 1,
    parentId: ROOT_PARENT_ID,
    src,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 2250,
      y: 2700,
    },
    type: "image",
    visible: true,
    width,
  };
};
