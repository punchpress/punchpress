import { buildVectorNodeGeometry } from "../vector/vector-engine";

export const buildPathNodeGeometry = (node) => {
  return buildVectorNodeGeometry({
    ...node,
    contours: [
      {
        closed: node.closed,
        fill: node.fill,
        fillRule: node.fillRule,
        segments: node.segments,
        stroke: node.stroke,
        strokeLineCap: node.strokeLineCap,
        strokeLineJoin: node.strokeLineJoin,
        strokeMiterLimit: node.strokeMiterLimit,
        strokeWidth: node.strokeWidth,
      },
    ],
  });
};
