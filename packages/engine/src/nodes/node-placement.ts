import { GROUP_NODE_PLACEMENT_CAPABILITIES } from "./group/group-placement";
import { SHAPE_NODE_PLACEMENT_CAPABILITIES } from "./shape/shape-placement";
import { TEXT_NODE_PLACEMENT_CAPABILITIES } from "./text/text-placement-capabilities";
import { VECTOR_NODE_PLACEMENT_CAPABILITIES } from "./vector/vector-placement";

const NODE_PLACEMENT_CAPABILITIES = {
  group: GROUP_NODE_PLACEMENT_CAPABILITIES,
  shape: SHAPE_NODE_PLACEMENT_CAPABILITIES,
  text: TEXT_NODE_PLACEMENT_CAPABILITIES,
  vector: VECTOR_NODE_PLACEMENT_CAPABILITIES,
};

export const getNodePlacementCapabilities = (nodeType) => {
  if (!nodeType) {
    return null;
  }

  return NODE_PLACEMENT_CAPABILITIES[nodeType] || null;
};
