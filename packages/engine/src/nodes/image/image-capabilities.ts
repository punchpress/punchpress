import {
  createPaintedHitRegion,
  withNodeGeometryBehavior,
} from "../../primitives/node-geometry";
import { toTransformedWorldFrame, toWorldFrame } from "../node-frame-utils";
import { createDefaultImageNode } from "./model";

export const getImageNodeBounds = (node) => {
  const width = Math.max(1, node.width);
  const height = Math.max(1, node.height);

  return {
    height,
    maxX: width,
    maxY: height,
    minX: 0,
    minY: 0,
    width,
  };
};

export const imageNodeCapabilities = {
  buildGeometry: (node) => {
    const bbox = getImageNodeBounds(node);
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
          fill: "#000000",
        }),
      ],
      id: node.id,
      paths: [],
      ready: true,
      selectionBounds: bbox,
    });
  },

  createDefaultNode: createDefaultImageNode,

  getFrameFromGeometry: (node, geometry, surface) => {
    switch (surface) {
      case "render":
        return toWorldFrame(node, geometry?.bbox || getImageNodeBounds(node));
      case "selection":
      case "transform":
        return toTransformedWorldFrame(
          node,
          geometry?.bbox || getImageNodeBounds(node)
        );
      default:
        return null;
    }
  },

  getFrame: (editor, nodeId, node, surface) => {
    const geometry = editor.getNodeGeometry(nodeId);

    return imageNodeCapabilities.getFrameFromGeometry(node, geometry, surface);
  },

  getGeometrySignature: (node, fontRevision) => {
    return JSON.stringify({
      fontRevision,
      height: node.height,
      src: node.src,
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

    return getImageNodeBounds(node);
  },

  getSurfaceGeometry: (editor, nodeId) => {
    return editor.getNodeGeometry(nodeId);
  },

  getHitBounds: (_, __, node) => {
    return getImageNodeBounds(node);
  },

  getEditCapabilities: () => ({
    canEditPath: false,
    canEditText: false,
    guide: null,
    hasExpandedHitBounds: false,
    pathEditingOverlayMode: "keep-transform",
    requiresPathEditing: false,
  }),

  getSourceKind: () => "raster",

  getResizeMode: () => "scale",

  getRotateMode: () => "self",

  canPersistPathEditing: () => false,

  getEditablePathSession: () => null,

  type: "image",
};
