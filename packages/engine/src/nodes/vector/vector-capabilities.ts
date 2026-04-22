import { toTransformedWorldFrame, toWorldFrame } from "../node-frame-utils";
import { createDefaultVectorNode } from "./model";
import { buildVectorNodeGeometry } from "./vector-engine";

const getVectorSurfaceGeometry = (editor, nodeId, node) => {
  if (Array.isArray(node.contours) && node.contours.length > 0) {
    return editor.getNodeGeometry(nodeId);
  }

  return editor.vectorRenderSurfaces.getById(editor, nodeId);
};

const supportsEditableContours = (node) => {
  return Array.isArray(node?.contours) && node.contours.length > 0;
};

const getContainerFrame = (geometry) => {
  if (!geometry?.bbox) {
    return null;
  }

  return {
    bounds: geometry.bbox,
    transform: undefined,
  };
};

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
    const geometry = getVectorSurfaceGeometry(editor, nodeId, node);

    if (!supportsEditableContours(node)) {
      return getContainerFrame(geometry);
    }

    return vectorNodeCapabilities.getFrameFromGeometry(node, geometry, surface);
  },

  getGeometrySignature: (node, fontRevision) => {
    return JSON.stringify({
      contours: node.contours,
      fontRevision,
      id: node.id,
      type: node.type,
    });
  },

  getLocalBounds: (editor, nodeId) => {
    const node = editor.getNode(nodeId);

    return node
      ? getVectorSurfaceGeometry(editor, nodeId, node)?.bbox || null
      : null;
  },

  getSurfaceGeometry: (editor, nodeId) => {
    const node = editor.getNode(nodeId);

    return node?.type === "vector"
      ? getVectorSurfaceGeometry(editor, nodeId, node)
      : null;
  },

  getHitBounds: (editor, nodeId) => {
    const node = editor.getNode(nodeId);

    return node
      ? getVectorSurfaceGeometry(editor, nodeId, node)?.bbox || null
      : null;
  },

  getEditCapabilities: (_editor, _nodeId, node) => {
    if (!supportsEditableContours(node)) {
      return {
        canEditPath: false,
        canEditText: false,
        guide: null,
        hasExpandedHitBounds: false,
        pathEditingOverlayMode: "keep-transform",
        requiresPathEditing: false,
      };
    }

    return {
      canEditPath: true,
      canEditText: false,
      guide: null,
      hasExpandedHitBounds: false,
      pathEditingOverlayMode: "replace-transform",
      requiresPathEditing: true,
    };
  },

  canPersistPathEditing: (node) => supportsEditableContours(node),

  getEditablePathSession: (editor, nodeId, node) => {
    if (!supportsEditableContours(node)) {
      return null;
    }

    return {
      backend: "vector-path",
      contours: node.contours || [],
      interactionPolicy: {
        canInsertPoint: true,
      },
      nodeId,
      nodeType: node.type,
      selectedPoints:
        editor.pathEditingNodeId === nodeId ? editor.pathEditingPoints : [],
      selectedPoint:
        editor.pathEditingNodeId === nodeId ? editor.pathEditingPoint : null,
    };
  },

  type: "vector",
};
