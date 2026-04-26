import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { createDefaultPathNode } from "../path/model";
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
    fallbackFill = null,
    fallbackFillRule = "nonzero",
    fallbackStroke = null,
    fallbackStrokeLineCap = null,
    fallbackStrokeLineJoin = null,
    fallbackStrokeMiterLimit = null,
    fallbackStrokeWidth = null,
    id,
    parentId,
  }
) => {
  const baseNode = createDefaultPathNode(parentId);

  return {
    ...baseNode,
    closed: contour.closed,
    fill: contour.fill ?? fallbackFill,
    fillRule: contour.fillRule ?? fallbackFillRule,
    id: contour.id || id || createId(),
    parentId,
    segments: contour.segments,
    stroke: contour.stroke ?? fallbackStroke,
    strokeLineCap:
      contour.strokeLineCap ?? fallbackStrokeLineCap ?? baseNode.strokeLineCap,
    strokeLineJoin:
      contour.strokeLineJoin ??
      fallbackStrokeLineJoin ??
      baseNode.strokeLineJoin,
    strokeMiterLimit:
      contour.strokeMiterLimit ??
      fallbackStrokeMiterLimit ??
      baseNode.strokeMiterLimit,
    strokeWidth:
      contour.strokeWidth ?? fallbackStrokeWidth ?? baseNode.strokeWidth,
    transform: defaultTransform,
    visible: contour.visible !== false,
  };
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
        fallbackFill: node.fill ?? null,
        fallbackFillRule: node.fillRule ?? "nonzero",
        fallbackStroke: node.stroke ?? null,
        fallbackStrokeLineCap: node.strokeLineCap,
        fallbackStrokeLineJoin: node.strokeLineJoin,
        fallbackStrokeMiterLimit: node.strokeMiterLimit,
        fallbackStrokeWidth: node.strokeWidth,
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
      fallbackFill: node.fill ?? null,
      fallbackFillRule: node.fillRule ?? "nonzero",
      fallbackStroke: node.stroke ?? null,
      fallbackStrokeLineCap: node.strokeLineCap,
      fallbackStrokeLineJoin: node.strokeLineJoin,
      fallbackStrokeMiterLimit: node.strokeMiterLimit,
      fallbackStrokeWidth: node.strokeWidth,
      id: contour.id || `${node.id}-path-${contourIndex + 1}`,
      parentId: vectorNode.id,
    });
  });

  return [vectorNode, ...childPathNodes];
};
