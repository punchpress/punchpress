import { getPaintHitStyle } from "../../appearance/paint-extent";
import { withNodeGeometryBehavior } from "../../primitives/node-geometry";
import { buildVectorNodeGeometry } from "../vector/vector-engine";
import { getPathNodeContours } from "./path-contours";

export const buildPathNodeGeometry = (node) => {
  const contours = getPathNodeContours(node);
  // Strokes align against the fill region (open contours close implicitly,
  // as SVG fills them); a path with no closed contour strokes on center.
  const hasClosedContour = contours.some((contour) => contour.closed);
  const paintHitStyle = getPaintHitStyle(node, hasClosedContour);
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
  const [firstRegion] = geometry.hitRegions;

  return withNodeGeometryBehavior({
    ...geometry,
    // One region over every contour, so holes and sides follow the fill rule.
    hitRegions: [
      {
        ...firstRegion,
        contours: geometry.hitRegions.flatMap((region) => region.contours),
      },
    ],
    paths: [
      {
        ...firstPath,
        closed: contours.every((contour) => contour.closed),
        d: geometry.paths.map((path) => path.d).join(" "),
        hasClosedContour,
      },
    ],
  });
};
