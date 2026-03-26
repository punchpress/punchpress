const NODE_PROPERTY_IDS = {
  group: [],
  shape: [
    "fill",
    "stroke",
    "strokeWidth",
    "x",
    "y",
    "width",
    "height",
    "shape",
  ],
  text: [
    "fill",
    "stroke",
    "strokeWidth",
    "x",
    "y",
    "text",
    "font",
    "fontSize",
    "tracking",
    "warp",
  ],
};

export const getNodePropertyIds = (node) => {
  if (!node) {
    return [];
  }

  return NODE_PROPERTY_IDS[node.type] || [];
};

export const supportsNodeProperty = (node, propertyId) => {
  return getNodePropertyIds(node).includes(propertyId);
};
