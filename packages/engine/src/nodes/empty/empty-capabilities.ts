import { createDefaultEmptyNode } from "./model";

export const emptyNodeCapabilities = {
  buildGeometry: () => null,

  createDefaultNode: createDefaultEmptyNode,

  getFrameFromGeometry: () => null,

  getFrame: () => null,

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

  getSourceKind: () => "empty",

  getResizeMode: () => "none",

  getRotateMode: () => "none",

  canPersistPathEditing: () => false,

  getEditablePathSession: () => null,

  type: "empty",
};
