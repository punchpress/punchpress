import { getDescendantLeafNodeIds } from "../nodes/node-tree";
import { getNodeWorldBounds } from "../primitives/rotation";
import { createDefaultGroupNode } from "./group/model";
import {
  createDefaultNode,
  getNodeCssTransform,
  getNodeX,
  getNodeY,
} from "./text/model";
import { buildNodeGeometry as buildWarpTextGeometry } from "./text/warp-engine";
import { estimateBounds } from "./text/warp-layout";

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

const getTextNodeSelectionBounds = (
  node,
  geometry,
  { useSelectionBounds = false } = {}
) => {
  if (useSelectionBounds) {
    return geometry?.selectionBounds || geometry?.bbox || estimateBounds(node);
  }

  return geometry?.bbox || estimateBounds(node);
};

const textNodeCapabilities = {
  buildGeometry: (node, font) => {
    if (!font) {
      return {
        bbox: estimateBounds(node),
        guide: null,
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

    return {
      canEditPath: Boolean(geometry?.guide),
      canEditText: true,
      guide: geometry?.guide || null,
      hasExpandedHitBounds: Boolean(geometry?.selectionBounds),
    };
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
  }),

  type: "group",
};

const nodeCapabilitiesByType = {
  group: groupNodeCapabilities,
  text: textNodeCapabilities,
};

export const getNodeCapabilities = (node) => {
  if (!node) {
    return null;
  }

  return nodeCapabilitiesByType[node.type] || null;
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
