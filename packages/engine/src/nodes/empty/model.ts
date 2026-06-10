import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { createId } from "../text/model";

export const getNextLayerName = (nodes) => {
  const layerCount = nodes.filter((node) => {
    return node.type === "empty" || node.type === "image";
  }).length;

  return `Layer ${layerCount + 1}`;
};

export const createDefaultEmptyNode = (name = "Layer") => {
  return {
    id: createId(),
    name,
    opacity: 1,
    parentId: ROOT_PARENT_ID,
    type: "empty",
    visible: true,
  };
};
