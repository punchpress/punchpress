import { getPaintSignature } from "../../appearance/paint-extent";
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
      fillRule: node.fillRule,
      fontRevision,
      paint: getPaintSignature(node),
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

  getSourceKind: () => "vector",

  getResizeMode: () => "scale",

  getRotateMode: () => "self",

  canPersistPathEditing: () => true,

  getEditablePathSession: (editor, nodeId, node) => ({
    backend: "vector-path",
    contours:
      editor.getPathEditingPreviewContours(nodeId) || getPathNodeContours(node),
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
