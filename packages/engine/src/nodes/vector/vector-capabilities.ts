import { toTransformedWorldFrame, toWorldFrame } from "../node-frame-utils";
import { createDefaultVectorNode } from "./model";
import { buildVectorNodeGeometry } from "./vector-engine";

export const vectorNodeCapabilities = {
  buildGeometry: (node) => {
    return buildVectorNodeGeometry(node);
  },

  createDefaultNode: () => {
    return createDefaultVectorNode();
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

    return vectorNodeCapabilities.getFrameFromGeometry(node, geometry, surface);
  },

  getGeometrySignature: (node, fontRevision) => {
    return JSON.stringify({
      contours: node.contours,
      fill: node.fill,
      fillRule: node.fillRule,
      fontRevision,
      stroke: node.stroke,
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

  canPersistPathEditing: () => true,

  getEditablePathSession: (editor, nodeId, node) => ({
    backend: "vector-path",
    contours: node.contours,
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

  type: "vector",
};
