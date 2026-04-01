import { toTransformedWorldFrame, toWorldFrame } from "../node-frame-utils";
import {
  buildShapeNodePath,
  getShapeEditablePathContours,
  getShapeNodeBounds,
  supportsShapeEditablePath,
} from "./shape-engine";
import { createDefaultShapeNode } from "./model";

export const shapeNodeCapabilities = {
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
      cornerRadius: node.cornerRadius ?? 0,
      fill: node.fill,
      fontRevision,
      height: node.height,
      points: node.points,
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

  getEditCapabilities: (_, __, node) => ({
    canEditPath: supportsShapeEditablePath(node),
    canEditText: false,
    guide: null,
    hasExpandedHitBounds: false,
    pathEditingOverlayMode: supportsShapeEditablePath(node)
      ? "replace-transform"
      : "keep-transform",
    requiresPathEditing: supportsShapeEditablePath(node),
  }),

  canPersistPathEditing: (node) => supportsShapeEditablePath(node),

  getEditablePathSession: (editor, nodeId, node) => {
    const contours = getShapeEditablePathContours(node);

    if (!contours) {
      return null;
    }

    return {
      backend: "vector-path",
      contours,
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

  type: "shape",
};
