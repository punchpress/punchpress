import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { createDefaultPathNode } from "../path/model";
import { withPathNodeContours } from "../path/path-contours";
import { createId } from "../text/model";
import { DEFAULT_VECTOR_PATH_COMPOSITION } from "./vector-path-composition";

export const isContourOwnedVector = (node) => {
  return (
    node?.type === "vector" &&
    Array.isArray(node.contours) &&
    node.contours.length > 0
  );
};

const createPathNodeFromContour = (
  contour,
  {
    defaultTransform,
    fallbackAppearance = null,
    fallbackFillRule = "nonzero",
    id,
    parentId,
  }
) => {
  const baseNode = createDefaultPathNode(parentId);

  return withPathNodeContours(
    {
      ...baseNode,
      appearance:
        contour.appearance ?? fallbackAppearance ?? baseNode.appearance,
      fillRule: contour.fillRule ?? fallbackFillRule,
      id: contour.id || id || createId(),
      parentId,
      transform: defaultTransform,
      visible: contour.visible !== false,
    },
    [
      {
        closed: contour.closed,
        segments: contour.segments,
      },
    ]
  );
};

export const expandContourOwnedVectorNode = (node) => {
  const contours = node.contours || [];

  if (contours.length === 0) {
    return [];
  }

  if (contours.length === 1) {
    return [
      createPathNodeFromContour(contours[0], {
        defaultTransform: node.transform,
        fallbackAppearance: node.appearance ?? null,
        fallbackFillRule: node.fillRule ?? "nonzero",
        id: node.id,
        parentId: node.parentId || ROOT_PARENT_ID,
      }),
    ];
  }

  const vectorNode = {
    compoundWrapper: node.compoundWrapper ?? false,
    id: node.id,
    name: node.name,
    parentId: node.parentId || ROOT_PARENT_ID,
    pathComposition: node.pathComposition ?? DEFAULT_VECTOR_PATH_COMPOSITION,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 0,
      y: 0,
    },
    type: "vector",
    visible: node.visible !== false,
  };

  const childPathNodes = contours.map((contour, contourIndex) => {
    return createPathNodeFromContour(contour, {
      defaultTransform: node.transform,
      fallbackAppearance: node.appearance ?? null,
      fallbackFillRule: node.fillRule ?? "nonzero",
      id: contour.id || `${node.id}-path-${contourIndex + 1}`,
      parentId: vectorNode.id,
    });
  });

  return [vectorNode, ...childPathNodes];
};
