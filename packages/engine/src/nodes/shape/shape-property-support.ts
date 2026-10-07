export const SHAPE_NODE_PROPERTY_IDS = [
  "appearance",
  "cornerRadius",
  "opacity",
  "x",
  "y",
  "width",
  "height",
  "shape",
];

export const supportsShapeProperty = (node, propertyId) => {
  if (!(node?.type === "shape")) {
    return false;
  }

  if (propertyId === "cornerRadius") {
    return node.shape === "polygon" || node.shape === "star";
  }

  return SHAPE_NODE_PROPERTY_IDS.includes(propertyId);
};
