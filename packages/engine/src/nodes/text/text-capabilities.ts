import { toTransformedWorldFrame, toWorldFrame } from "../node-frame-utils";
import { createDefaultNode } from "./model";
import {
  getArchGuide,
  getCircleGuide,
  getSlantGuide,
  getWaveGuide,
} from "./text-path";
import { buildNodeGeometry as buildWarpTextGeometry } from "./warp-engine";
import { estimateBounds } from "./warp-layout";

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

export const textNodeCapabilities = {
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

  getEditablePathSession: () => null,

  type: "text",
};
