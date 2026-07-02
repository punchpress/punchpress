import {
  DEFAULT_VECTOR_STROKE_LINE_CAP,
  DEFAULT_VECTOR_STROKE_LINE_JOIN,
  DEFAULT_VECTOR_STROKE_MITER_LIMIT,
} from "@punchpress/engine";
import {
  getGroupNodeArtState,
  getNodeOpacity,
  getNodeRenderPaths,
} from "./node-render-tree";

export const mergeNodeUpdate = (node, nodeUpdate) => {
  return {
    ...node,
    ...nodeUpdate,
    transform: {
      ...node.transform,
      ...(nodeUpdate?.transform || {}),
    },
  };
};

export const getResizePreviewNode = (editor, nodeId) => {
  const preview = editor.selectionDragPreview;
  const resize = preview?.resize;
  const nodeUpdate = resize?.nodeUpdate;
  const node = editor.getNode(nodeId);

  if (!(node && nodeUpdate && preview.nodeIds?.includes(nodeId))) {
    return null;
  }

  return mergeNodeUpdate(node, nodeUpdate);
};

export const selectNodeArtState = (
  editor,
  state,
  nodeId,
  previewNode = null
) => {
  const node = previewNode || editor.getNode(nodeId);

  if (!node) {
    return null;
  }

  if (node.type === "group") {
    return getGroupNodeArtState(editor, state, nodeId);
  }

  const geometry = previewNode
    ? editor.buildPreviewNodeGeometry(previewNode)
    : editor.getNodeRenderGeometry(nodeId);
  const bbox = geometry?.bbox ||
    editor.getNodeRenderFrame(nodeId)?.bounds || {
      height: 0,
      maxX: 0,
      maxY: 0,
      minX: 0,
      minY: 0,
      width: 0,
    };

  return {
    bbox,
    fill: node.fill,
    fillRule: node.type === "path" ? node.fillRule : undefined,
    isEditing: state.editingNodeId === nodeId,
    opacity: getNodeOpacity(node),
    paths: getNodeRenderPaths(editor, node, geometry?.paths || []),
    ready: Boolean(geometry?.ready),
    image: node.type === "image" ? node : null,
    renderMode: "paths",
    renderTree: null,
    stroke: node.stroke,
    strokeLineCap:
      node.type === "path"
        ? (node.strokeLineCap ?? DEFAULT_VECTOR_STROKE_LINE_CAP)
        : DEFAULT_VECTOR_STROKE_LINE_CAP,
    strokeLineJoin:
      node.type === "path"
        ? (node.strokeLineJoin ?? DEFAULT_VECTOR_STROKE_LINE_JOIN)
        : DEFAULT_VECTOR_STROKE_LINE_JOIN,
    strokeMiterLimit:
      node.type === "path"
        ? (node.strokeMiterLimit ?? DEFAULT_VECTOR_STROKE_MITER_LIMIT)
        : DEFAULT_VECTOR_STROKE_MITER_LIMIT,
    strokeWidth: node.strokeWidth,
  };
};

export const selectNodeReadyState = (editor, _state, nodeId) => {
  return Boolean(editor.getNode(nodeId));
};

export const selectNodeArtInputs = (editor, state, nodeId) => {
  return {
    editingNodeId: state.editingNodeId,
    fontRevision: state.fontRevision,
    node: editor.getNode(nodeId),
    nodes: state.nodes,
  };
};

export const getMemoizedNodeArtState = (
  editor,
  nodeId,
  _artInputs,
  _revision = 0,
  previewNode = null
) => {
  return selectNodeArtState(editor, editor.getState(), nodeId, previewNode);
};
