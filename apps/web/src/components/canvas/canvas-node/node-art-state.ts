import {
  buildAppearanceObjects,
  getNodeAppearance,
  getPrimaryPaint,
} from "@punchpress/engine";
import {
  getGroupNodeArtState,
  getNodeOpacity,
  getSvgNodeAncestorOpacityChain,
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
  const fallbackText = editor.getTextFallbackPreview(node, geometry);

  return {
    bbox,
    fallbackPaint: fallbackText
      ? getPrimaryPaint(getNodeAppearance(node))
      : null,
    fallbackText,
    image: node.type === "image" ? node : null,
    isEditing: state.editingNodeId === nodeId,
    isInteractionProxy: false,
    objects: buildAppearanceObjects(node, geometry?.paths, (id) =>
      editor.getNode(id)
    ),
    opacity:
      getNodeOpacity(node) * getSvgNodeAncestorOpacityChain(editor, node.id),
    ready: Boolean(geometry?.ready),
    renderTree: null,
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
