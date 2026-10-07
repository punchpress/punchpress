import { getPaintHitStyle } from "../../appearance/paint-extent";
import { withNodeGeometryBehavior } from "../../primitives/node-geometry";
import { buildVectorNodeGeometry } from "../vector/vector-engine";
import { getPathNodeContours } from "./path-contours";

export const buildPathNodeGeometry = (node) => {
  const contours = getPathNodeContours(node);
  const paintHitStyle = getPaintHitStyle(node);
  const geometry = buildVectorNodeGeometry({
    ...node,
    contours: contours.map((contour) => {
      return {
        ...contour,
        ...paintHitStyle,
        fillRule: node.fillRule,
      };
    }),
  });

  if (!(geometry?.paths?.length > 1)) {
    return geometry;
  }

  const [firstPath] = geometry.paths;

  return withNodeGeometryBehavior({
    ...geometry,
    paths: [
      {
        ...firstPath,
        closed: contours.every((contour) => contour.closed),
        d: geometry.paths.map((path) => path.d).join(" "),
      },
    ],
  });
};
