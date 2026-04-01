import { GROUP_NODE_PROPERTY_IDS } from "./group/group-property-support";
import {
  SHAPE_NODE_PROPERTY_IDS,
  supportsShapeProperty,
} from "./shape/shape-property-support";
import { TEXT_NODE_PROPERTY_IDS } from "./text/text-property-support";
import { VECTOR_NODE_PROPERTY_IDS } from "./vector/vector-property-support";

const NODE_PROPERTY_IDS = {
  group: GROUP_NODE_PROPERTY_IDS,
  shape: SHAPE_NODE_PROPERTY_IDS,
  text: TEXT_NODE_PROPERTY_IDS,
  vector: VECTOR_NODE_PROPERTY_IDS,
};

export const getNodePropertyIds = (node) => {
  if (!node) {
    return [];
  }

  return NODE_PROPERTY_IDS[node.type] || [];
};

export const supportsNodeProperty = (node, propertyId) => {
  if (node?.type === "shape") {
    return supportsShapeProperty(node, propertyId);
  }

  return getNodePropertyIds(node).includes(propertyId);
};
