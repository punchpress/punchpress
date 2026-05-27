import {
  DEFAULT_VECTOR_STROKE_LINE_CAP,
  DEFAULT_VECTOR_STROKE_LINE_JOIN,
  DEFAULT_VECTOR_STROKE_MITER_LIMIT,
} from "@punchpress/punch-schema";
import { toTransformedWorldFrame, toWorldFrame } from "../node-frame-utils";
import { createDefaultPathNode } from "./model";
import { getPathNodeContours } from "./path-contours";
import { buildPathNodeGeometry } from "./path-engine";

export const pathNodeCapabilities = {
  buildGeometry: (node) => {
    return buildPathNodeGeometry(node);
  },

  createDefaultNode: (parentId) => {
    return createDefaultPathNode(parentId);
  },

  getFrameFromGeometry: (node, geometry, surface) => {
    switch (surface) {
      case "render":
        return toWorldFrame(node, geometry?.bbox);
      case "selection":
      case "transform":
        return toTransformedWorldFrame(node, geometry?.bbox);
      default:
        return null;
    }
  },

  getFrame: (editor, nodeId, node, surface) => {
    const geometry = editor.getNodeGeometry(nodeId);

    return pathNodeCapabilities.getFrameFromGeometry(node, geometry, surface);
  },

  getGeometrySignature: (node, fontRevision) => {
    return JSON.stringify({
      contours: getPathNodeContours(node),
      fill: node.fill,
      fillRule: node.fillRule,
      fontRevision,
      stroke: node.stroke,
      strokeLineCap: node.strokeLineCap ?? DEFAULT_VECTOR_STROKE_LINE_CAP,
      strokeLineJoin: node.strokeLineJoin ?? DEFAULT_VECTOR_STROKE_LINE_JOIN,
      strokeMiterLimit:
        node.strokeMiterLimit ?? DEFAULT_VECTOR_STROKE_MITER_LIMIT,
      strokeWidth: node.strokeWidth,
    });
  },

  getLocalBounds: (editor, nodeId) => {
    return editor.getNodeGeometry(nodeId)?.bbox || null;
  },

  getSurfaceGeometry: (editor, nodeId) => {
    return editor.getNodeGeometry(nodeId);
  },

  getHitBounds: (editor, nodeId) => {
    return editor.getNodeGeometry(nodeId)?.bbox || null;
  },

  getEditCapabilities: () => ({
    canEditPath: true,
    canEditText: false,
    guide: null,
    hasExpandedHitBounds: false,
    pathEditingOverlayMode: "replace-transform",
    requiresPathEditing: true,
  }),

  getResizeMode: () => "scale",

  getRotateMode: () => "self",

  canPersistPathEditing: () => true,

  getEditablePathSession: (editor, nodeId, node) => ({
    backend: "vector-path",
    contours: getPathNodeContours(node),
    interactionPolicy: {
      canInsertPoint: true,
    },
    nodeId,
    nodeType: node.type,
    selectedPoints:
      editor.pathEditingNodeId === nodeId ? editor.pathEditingPoints : [],
    selectedPoint:
      editor.pathEditingNodeId === nodeId ? editor.pathEditingPoint : null,
  }),

  type: "path",
};
