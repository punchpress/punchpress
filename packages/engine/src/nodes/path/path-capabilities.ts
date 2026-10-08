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
    return [
      getContoursSignature(getPathNodeContours(node)),
      node.fillRule,
      fontRevision,
      getPaintSignature(node),
    ].join("|");
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

// Contour arrays are immutable in the store, so moved or restyled paths
// reuse the serialized contours of their unchanged geometry.
const contoursSignatures = new WeakMap<object, string>();

const getContoursSignature = (contours) => {
  const cached = contoursSignatures.get(contours);

  if (cached !== undefined) {
    return cached;
  }

  const signature = JSON.stringify(contours);
  contoursSignatures.set(contours, signature);

  return signature;
};
