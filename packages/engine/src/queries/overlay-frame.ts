import { toTransformedWorldFrame } from "../nodes/node-frame-utils";

export const getOverlayWorldFrame = (node, bounds) => {
  return toTransformedWorldFrame(node, bounds);
};
