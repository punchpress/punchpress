import { getDescendantLeafNodeIds } from "../nodes/node-tree";
import { getNodeWorldBounds } from "../primitives/rotation";
import { createDefaultGroupNode } from "./group/model";
import { createDefaultShapeNode } from "./shape/model";
import { buildShapeNodePath, getShapeNodeBounds } from "./shape/shape-engine";
import {
  createDefaultNode,
  getNodeCssTransform,
  getNodeX,
  getNodeY,
} from "./text/model";
import {
  getArchGuide,
  getCircleGuide,
  getSlantGuide,
  getWaveGuide,
} from "./text/text-path";
import { buildNodeGeometry as buildWarpTextGeometry } from "./text/warp-engine";
import { estimateBounds } from "./text/warp-layout";
import { createDefaultVectorNode } from "./vector/model";
import { buildVectorNodeGeometry } from "./vector/vector-engine";

const toWorldFrame = (node, bounds) => {
  if (!bounds) {
    return null;
  }

  return {
    bounds: {
      height: bounds.height,
      maxX: getNodeX(node) + bounds.maxX,
      maxY: getNodeY(node) + bounds.maxY,
      minX: getNodeX(node) + bounds.minX,
      minY: getNodeY(node) + bounds.minY,
      width: bounds.width,
    },
    transform: getNodeCssTransform(node),
  };
};

const toTransformedWorldFrame = (node, bounds) => {
  if (!bounds) {
    return null;
  }

  return {
    bounds: getNodeWorldBounds(node, bounds),
    transform: getNodeCssTransform(node),
  };
};

const getTextNodeRenderBounds = (node, geometry) => {
  return geometry?.bbox || estimateBounds(node);
};

const getFallbackTextGuide = (node, bbox) => {
  if (node.warp.kind === "arch") {
    return getArchGuide(bbox, node.warp.bend, bbox);
  }

  if (node.warp.kind === "circle") {
    return getCircleGuide(node.warp);
  }

  if (node.warp.kind === "wave") {
    return getWaveGuide(bbox, node.warp.amplitude, node.warp.cycles, bbox);
  }

  if (node.warp.kind === "slant") {
    return getSlantGuide(bbox, node.warp.rise, bbox);
  }

  return null;
};

const getTextNodeSelectionBounds = (
  node,
  geometry,
  { useGuideBounds = false, useSelectionBounds = false } = {}
) => {
  if (useGuideBounds && geometry?.guide?.bounds) {
    return geometry.guide.bounds;
  }

  if (useSelectionBounds) {
    return geometry?.selectionBounds || geometry?.bbox || estimateBounds(node);
  }

  return geometry?.bbox || estimateBounds(node);
};

const textNodeCapabilities = {
  buildGeometry: (node, font) => {
    if (!font) {
      const bbox = estimateBounds(node);

      return {
        bbox,
        guide: getFallbackTextGuide(node, bbox),
        id: node.id,
        paths: [],
        ready: false,
        selectionBounds: null,
      };
    }

    const geometry = buildWarpTextGeometry(node, font);

    return {
      bbox: geometry.bbox,
      guide: geometry.guide || null,
      id: node.id,
      paths: geometry.paths,
      ready: geometry.ready,
      selectionBounds: geometry.selectionBounds || null,
    };
  },

  createDefaultNode: (font) => {
    return createDefaultNode(font);
  },

  getFrameFromGeometry: (node, geometry, surface, options = {}) => {
    switch (surface) {
      case "render":
        return toWorldFrame(node, getTextNodeRenderBounds(node, geometry));
      case "selection":
      case "transform":
        return toTransformedWorldFrame(
          node,
          getTextNodeSelectionBounds(node, geometry, options)
        );
      default:
        return null;
    }
  },

  getFrame: (editor, nodeId, node, surface, options = {}) => {
    const geometry = editor.getNodeGeometry(nodeId);

    return textNodeCapabilities.getFrameFromGeometry(
      node,
      geometry,
      surface,
      options
    );
  },

  getGeometrySignature: (node, fontRevision) => {
    return JSON.stringify({
      fontRevision,
      font: node.font,
      fontSize: node.fontSize,
      strokeWidth: node.strokeWidth,
      text: node.text,
      tracking: node.tracking,
      warp: node.warp,
    });
  },

  getLocalBounds: (editor, nodeId, node, surface, options = {}) => {
    const geometry = editor.getNodeGeometry(nodeId);

    switch (surface) {
      case "render":
        return getTextNodeRenderBounds(node, geometry);
      case "selection":
      case "transform":
        return getTextNodeSelectionBounds(node, geometry, options);
      default:
        return null;
    }
  },

  getSurfaceGeometry: (editor, nodeId) => {
    return editor.getNodeGeometry(nodeId);
  },

  getHitBounds: (editor, nodeId, node) => {
    const geometry = editor.getNodeGeometry(nodeId);

    return geometry?.selectionBounds || geometry?.bbox || estimateBounds(node);
  },

  getEditCapabilities: (editor, nodeId) => {
    const geometry = editor.getNodeGeometry(nodeId);
    const guide = geometry?.guide || null;

    return {
      canEditPath: Boolean(guide),
      canEditText: true,
      guide,
      hasExpandedHitBounds: Boolean(geometry?.selectionBounds),
      pathEditingOverlayMode: "keep-transform",
      requiresPathEditing: guide?.kind === "circle",
    };
  },

  canPersistPathEditing: (node) => {
    return node?.warp?.kind === "circle";
  },

  type: "text",
};

const groupNodeCapabilities = {
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

  type: "group",
};

const shapeNodeCapabilities = {
  buildGeometry: (node) => {
    const bbox = getShapeNodeBounds(node);

    return {
      bbox,
      guide: null,
      id: node.id,
      paths: [
        {
          d: buildShapeNodePath(node),
          key: `${node.shape}-0`,
        },
      ],
      ready: true,
      selectionBounds: bbox,
    };
  },

  createDefaultNode: (shape) => {
    return createDefaultShapeNode(shape);
  },

  getFrameFromGeometry: (node, geometry, surface) => {
    switch (surface) {
      case "render":
        return toWorldFrame(node, geometry?.bbox || getShapeNodeBounds(node));
      case "selection":
      case "transform":
        return toTransformedWorldFrame(
          node,
          geometry?.bbox || getShapeNodeBounds(node)
        );
      default:
        return null;
    }
  },

  getFrame: (editor, nodeId, node, surface) => {
    const geometry = editor.getNodeGeometry(nodeId);

    return shapeNodeCapabilities.getFrameFromGeometry(node, geometry, surface);
  },

  getGeometrySignature: (node, fontRevision) => {
    return JSON.stringify({
      fill: node.fill,
      fontRevision,
      height: node.height,
      shape: node.shape,
      stroke: node.stroke,
      strokeWidth: node.strokeWidth,
      width: node.width,
    });
  },

  getLocalBounds: (editor, nodeId, node, surface) => {
    if (
      !(
        surface === "render" ||
        surface === "selection" ||
        surface === "transform"
      )
    ) {
      return null;
    }

    return editor.getNodeGeometry(nodeId)?.bbox || getShapeNodeBounds(node);
  },

  getSurfaceGeometry: (editor, nodeId) => {
    return editor.getNodeGeometry(nodeId);
  },

  getHitBounds: (editor, nodeId, node) => {
    return editor.getNodeGeometry(nodeId)?.bbox || getShapeNodeBounds(node);
  },

  getEditCapabilities: () => ({
    canEditPath: false,
    canEditText: false,
    guide: null,
    hasExpandedHitBounds: false,
    pathEditingOverlayMode: "keep-transform",
    requiresPathEditing: false,
  }),

  canPersistPathEditing: () => false,

  type: "shape",
};

const vectorNodeCapabilities = {
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

  type: "vector",
};

const nodeCapabilitiesByType = {
  group: groupNodeCapabilities,
  shape: shapeNodeCapabilities,
  text: textNodeCapabilities,
  vector: vectorNodeCapabilities,
};

export const getNodeCapabilities = (node) => {
  if (!node) {
    return null;
  }

  return nodeCapabilitiesByType[node.type] || null;
};

export const canNodePersistPathEditing = (node) => {
  return getNodeCapabilities(node)?.canPersistPathEditing?.(node);
};

export const getNodeFrameFromGeometry = (
  node,
  geometry,
  surface,
  options = {}
) => {
  return (
    getNodeCapabilities(node)?.getFrameFromGeometry(
      node,
      geometry,
      surface,
      options
    ) || null
  );
};

export const buildNodeCapabilityGeometry = (node, font) => {
  return getNodeCapabilities(node)?.buildGeometry(node, font) || null;
};

export const getNodeGeometrySignature = (node, fontRevision) => {
  return getNodeCapabilities(node)?.getGeometrySignature(node, fontRevision);
};

export const getNodeSurfaceFrame = (editor, nodeId, surface, options = {}) => {
  const node = editor.getNode(nodeId);

  if (!node) {
    return null;
  }

  return getNodeCapabilities(node)?.getFrame(
    editor,
    nodeId,
    node,
    surface,
    options
  );
};

export const getNodeSurfaceGeometry = (editor, nodeId) => {
  const node = editor.getNode(nodeId);

  if (!node) {
    return null;
  }

  return getNodeCapabilities(node)?.getSurfaceGeometry(editor, nodeId) || null;
};

export const getNodeSurfaceLocalBounds = (
  editor,
  nodeId,
  surface,
  options = {}
) => {
  const node = editor.getNode(nodeId);

  if (!node) {
    return null;
  }

  return getNodeCapabilities(node)?.getLocalBounds(
    editor,
    nodeId,
    node,
    surface,
    options
  );
};

export const getNodeHitBounds = (editor, nodeId) => {
  const node = editor.getNode(nodeId);

  if (!node) {
    return null;
  }

  return getNodeCapabilities(node)?.getHitBounds(editor, nodeId, node) || null;
};

export const getNodeEditCapabilities = (editor, nodeId) => {
  const node = editor.getNode(nodeId);

  if (!node) {
    return null;
  }

  return (
    getNodeCapabilities(node)?.getEditCapabilities(editor, nodeId, node) || null
  );
};
