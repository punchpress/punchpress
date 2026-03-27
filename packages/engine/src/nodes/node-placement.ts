const NODE_PLACEMENT_CAPABILITIES = {
  group: {
    mode: "none",
  },
  shape: {
    mode: "box-drag",
  },
  text: {
    mode: "click",
  },
  vector: {
    mode: "click",
  },
};

export const getNodePlacementCapabilities = (nodeType) => {
  if (!nodeType) {
    return null;
  }

  return NODE_PLACEMENT_CAPABILITIES[nodeType] || null;
};
