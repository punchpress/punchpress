import { artboardNodeCapabilities } from "./artboard/artboard-capabilities";
import { groupNodeCapabilities } from "./group/group-capabilities";
import { imageNodeCapabilities } from "./image/image-capabilities";
import { pathNodeCapabilities } from "./path/path-capabilities";
import { shapeNodeCapabilities } from "./shape/shape-capabilities";
import { textNodeCapabilities } from "./text/text-capabilities";
import { vectorNodeCapabilities } from "./vector/vector-capabilities";

const nodeCapabilitiesByType = {
  artboard: artboardNodeCapabilities,
  group: groupNodeCapabilities,
  image: imageNodeCapabilities,
  path: pathNodeCapabilities,
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

export const getNodeResizeMode = (editor, nodeId) => {
  const node = editor.getNode(nodeId);

  if (!node) {
    return "none";
  }

  return (
    getNodeCapabilities(node)?.getResizeMode?.(editor, nodeId, node) || "none"
  );
};

export const getNodeRotateMode = (editor, nodeId) => {
  const node = editor.getNode(nodeId);

  if (!node) {
    return "none";
  }

  return (
    getNodeCapabilities(node)?.getRotateMode?.(editor, nodeId, node) || "none"
  );
};

export const getNodeEditablePathSession = (editor, nodeId) => {
  const node = editor.getNode(nodeId);

  if (!node) {
    return null;
  }

  return (
    getNodeCapabilities(node)?.getEditablePathSession?.(editor, nodeId, node) ||
    null
  );
};
