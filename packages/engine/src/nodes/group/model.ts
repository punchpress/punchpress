import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { createId } from "../text/model";

export const getNextGroupName = (nodes) => {
  const groupCount = nodes.filter((node) => node.type === "group").length;
  return `Group ${groupCount + 1}`;
};

export const createDefaultGroupNode = (name = "Group") => {
  return {
    id: createId(),
    name,
    parentId: ROOT_PARENT_ID,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 0,
      y: 0,
    },
    type: "group",
    visible: true,
  };
};
