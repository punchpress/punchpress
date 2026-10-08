import {
  buildAppearanceObjects,
  getLeafEffectPresentation,
  getNodeAppearance,
  getPrimaryPaint,
} from "@punchpress/engine";
import { getGroupNodeArtState, getNodeOpacity } from "./node-render-tree";

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
  const isEditingText = state.editingNodeId === nodeId && !previewNode;
  const node = previewNode || editor.getNode(nodeId);

  if (!node) {
    return null;
  }

  if (node.type === "group") {
    return getGroupNodeArtState(editor, state, nodeId);
  }

  const geometry = getArtGeometry(editor, nodeId, previewNode, isEditingText);
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
  const paintNode = previewNode ? node : editor.getPaintNode(nodeId) || node;

  return {
    bbox,
    // Shadows follow whatever geometry paints, including the live text edit.
    effects:
      node.type === "image"
        ? null
        : getLeafEffectPresentation(paintNode, geometry ?? { bbox }),
    fallbackPaint: fallbackText
      ? getPrimaryPaint(getNodeAppearance(paintNode))
      : null,
    fallbackText,
    image: node.type === "image" ? node : null,
    // Text edits paint their live preview here; other edited art hides.
    isEditing: state.editingNodeId === nodeId && !isEditingText,
    isEditingText,
    isInteractionProxy: false,
    objects: buildAppearanceObjects(paintNode, geometry, (id) =>
      editor.getPaintNode(id)
    ),
    // Ancestor opacity lives on the group and artboard layers.
    opacity: getNodeOpacity(node),
    ready: Boolean(geometry?.ready),
    renderTree: null,
  };
};

export const selectNodeArtInputs = (editor, state, nodeId) => {
  return {
    editingNodeId: state.editingNodeId,
    editingText: state.editingNodeId === nodeId ? state.editingText : null,
    fontRevision: state.fontRevision,
    revision: editor.getNodeArtRevision(nodeId),
  };
};

// Inputs, preview revision, and paint preview are memo keys for the caller;
// the derivation reads live editor state.
export const getMemoizedNodeArtState = (
  editor,
  nodeId,
  _artInputs,
  _revision = 0,
  previewNode = null
) => {
  return selectNodeArtState(editor, editor.getState(), nodeId, previewNode);
};

const getArtGeometry = (editor, nodeId, previewNode, isEditingText) => {
  if (isEditingText) {
    return (
      editor.editingPreviewGeometry || editor.getNodeRenderGeometry(nodeId)
    );
  }

  return previewNode
    ? editor.buildPreviewNodeGeometry(previewNode)
    : editor.getNodeRenderGeometry(nodeId);
};
