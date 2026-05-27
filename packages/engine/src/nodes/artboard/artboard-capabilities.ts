import {
  createPaintedHitRegion,
  withNodeGeometryBehavior,
} from "../../primitives/node-geometry";
import { toTransformedWorldFrame, toWorldFrame } from "../node-frame-utils";
import { createDefaultArtboardNode } from "./model";

export const getArtboardNodeBounds = (node) => {
  return {
    height: Math.max(1, node.height),
    maxX: Math.max(1, node.width),
    maxY: Math.max(1, node.height),
    minX: 0,
    minY: 0,
    width: Math.max(1, node.width),
  };
};

export const artboardNodeCapabilities = {
  buildGeometry: (node) => {
    const bbox = getArtboardNodeBounds(node);
    const contours = [
      {
        closed: true,
        points: [
          { x: bbox.minX, y: bbox.minY },
          { x: bbox.maxX, y: bbox.minY },
          { x: bbox.maxX, y: bbox.maxY },
          { x: bbox.minX, y: bbox.maxY },
        ],
      },
    ];

    return withNodeGeometryBehavior({
      bbox,
      guide: null,
      hitRegions: [
        createPaintedHitRegion({
          contours,
          fill: node.background || "#ffffff",
        }),
      ],
      id: node.id,
      paths: [],
      ready: true,
      selectionBounds: bbox,
    });
  },

  createDefaultNode: (name) => {
    return createDefaultArtboardNode(name);
  },

  getFrameFromGeometry: (node, geometry, surface) => {
    switch (surface) {
      case "render":
        return toWorldFrame(node, geometry?.bbox || getArtboardNodeBounds(node));
      case "selection":
      case "transform":
        return toTransformedWorldFrame(
          node,
          geometry?.bbox || getArtboardNodeBounds(node)
        );
      default:
        return null;
    }
  },

  getFrame: (editor, nodeId, node, surface) => {
    const geometry = editor.getNodeGeometry(nodeId);

    return artboardNodeCapabilities.getFrameFromGeometry(
      node,
      geometry,
      surface
    );
  },

  getGeometrySignature: (node, fontRevision) => {
    return JSON.stringify({
      background: node.background,
      fontRevision,
      height: node.height,
      width: node.width,
    });
  },

  getLocalBounds: (_, __, node, surface) => {
    if (
      !(
        surface === "render" ||
        surface === "selection" ||
        surface === "transform"
      )
    ) {
      return null;
    }

    return getArtboardNodeBounds(node);
  },

  getSurfaceGeometry: (editor, nodeId) => {
    return editor.getNodeGeometry(nodeId);
  },

  getHitBounds: (_, __, node) => {
    return getArtboardNodeBounds(node);
  },

  getEditCapabilities: () => ({
    canEditPath: false,
    canEditText: false,
    guide: null,
    hasExpandedHitBounds: false,
    pathEditingOverlayMode: "keep-transform",
    requiresPathEditing: false,
  }),

  getResizeMode: () => "bounds",

  getRotateMode: () => "none",

  canPersistPathEditing: () => false,

  getEditablePathSession: () => null,

  type: "artboard",
};
