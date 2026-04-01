import { getDescendantLeafNodeIds } from "../node-tree";
import { createDefaultGroupNode } from "./model";

export const groupNodeCapabilities = {
  buildGeometry: () => null,

  createDefaultNode: (name) => {
    return createDefaultGroupNode(name);
  },

  getFrameFromGeometry: () => null,

  getFrame: (editor, nodeId) => {
    const descendantLeafNodeIds = getDescendantLeafNodeIds(
      editor.nodes,
      nodeId
    );
    if (descendantLeafNodeIds.length === 0) {
      return null;
    }

    const bounds = editor.getSelectionBounds(descendantLeafNodeIds);
    if (!bounds) {
      return null;
    }

    return {
      bounds,
      transform: undefined,
    };
  },

  getGeometrySignature: (node, fontRevision) => {
    return `${fontRevision}:${node.id}:${node.type}`;
  },

  getLocalBounds: () => null,

  getSurfaceGeometry: () => null,

  getHitBounds: () => null,

  getEditCapabilities: () => ({
    canEditPath: false,
    canEditText: false,
    guide: null,
    hasExpandedHitBounds: false,
    pathEditingOverlayMode: "keep-transform",
    requiresPathEditing: false,
  }),

  canPersistPathEditing: () => false,

  getEditablePathSession: () => null,

  type: "group",
};
