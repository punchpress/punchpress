import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { ARTBOARD_HEIGHT, ARTBOARD_WIDTH } from "../../constants";
import { createId } from "../text/model";

export const getNextArtboardName = (nodes) => {
  const artboardCount = nodes.filter((node) => node.type === "artboard").length;
  return `Artboard ${artboardCount + 1}`;
};

export const createDefaultArtboardNode = (name = "Artboard") => {
  return {
    background: "#ffffff",
    height: ARTBOARD_HEIGHT,
    id: createId(),
    locked: false,
    name,
    parentId: ROOT_PARENT_ID,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 0,
      y: 0,
    },
    type: "artboard",
    visible: true,
    width: ARTBOARD_WIDTH,
  };
};
