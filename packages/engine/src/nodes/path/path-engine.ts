import { buildVectorNodeGeometry } from "../vector/vector-engine";
import { getPathNodeContours } from "./path-contours";

export const buildPathNodeGeometry = (node) => {
  const contours = getPathNodeContours(node);
  const geometry = buildVectorNodeGeometry({
    ...node,
    contours: contours.map((contour) => {
      return {
        ...contour,
        fill: node.fill,
        fillRule: node.fillRule,
        stroke: node.stroke,
        strokeLineCap: node.strokeLineCap,
        strokeLineJoin: node.strokeLineJoin,
        strokeMiterLimit: node.strokeMiterLimit,
        strokeWidth: node.strokeWidth,
      };
    }),
  });

  if (!(geometry?.paths?.length > 1)) {
    return geometry;
  }

  const [firstPath] = geometry.paths;

  return {
    ...geometry,
    paths: [
      {
        ...firstPath,
        closed: contours.every((contour) => contour.closed),
        d: geometry.paths.map((path) => path.d).join(" "),
      },
    ],
  };
};
