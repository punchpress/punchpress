import { buildVectorNodeGeometry } from "../vector/vector-engine";

export const buildPathNodeGeometry = (node) => {
  return buildVectorNodeGeometry({
    ...node,
    contours: [
      {
        closed: node.closed,
        segments: node.segments,
      },
    ],
  });
};
