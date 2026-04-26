import { isContainerNode, isGroupNode } from "../nodes/node-tree";

const getVisibleSelectedNodeIds = (
  editor,
  nodeIds = editor.selectedNodeIds
) => {
  return nodeIds.filter((nodeId) => {
    return (
      editor.isNodeEffectivelyVisible(nodeId) &&
      Boolean(editor.getNodeFrame(nodeId))
    );
  });
};

const getTransformFlags = ({
  activeTool,
  editingNodeId,
  hasGroupSelection,
  isPathEditingSelection,
  isTextPathPositioning,
  selectedBounds,
  selectedEditCapabilities,
  selectedNode,
}) => {
  if (isPathEditingSelection) {
    return {
      isDraggable: false,
      isResizable: Boolean(
        activeTool === "pointer" &&
          selectedNode &&
          selectedEditCapabilities &&
          !editingNodeId &&
          !isTextPathPositioning
      ),
      isRotatable: false,
    };
  }

  return {
    isDraggable: Boolean(
      activeTool === "pointer" &&
        Boolean(selectedNode || hasGroupSelection) &&
        !editingNodeId
    ),
    isResizable: Boolean(
      activeTool === "pointer" &&
        (hasGroupSelection ? selectedBounds : selectedNode) &&
        (hasGroupSelection || (selectedNode && selectedEditCapabilities)) &&
        !editingNodeId
    ),
    isRotatable: Boolean(
      activeTool === "pointer" &&
        (hasGroupSelection ? selectedBounds : selectedEditCapabilities) &&
        !editingNodeId
    ),
  };
};

const getSelectionGhostPreview = (editor, nodeId) => {
  const node = editor.getNode(nodeId);
  const parentNode = node?.parentId ? editor.getNode(node.parentId) : null;

  if (!(node?.type === "path" && parentNode?.type === "vector")) {
    return null;
  }

  const geometry = editor.getNodeRenderGeometry(nodeId);

  if (!(geometry?.bbox && geometry.paths?.length)) {
    return null;
  }

  return {
    bbox: geometry.bbox,
    nodeId,
    paths: geometry.paths,
  };
};

export const getHoveredNodePreview = (editor) => {
  const state = editor.getState();
  const hoveredNodeId = state.hoveredNodeId;

  if (
    state.spacePressed ||
    editor.activeTool !== "pointer" ||
    editor.editingNodeId ||
    state.isHoveringSuppressed ||
    !hoveredNodeId
  ) {
    return null;
  }

  const node = editor.getNode(hoveredNodeId);

  if (!(node && editor.isNodeEffectivelyVisible(node.id))) {
    return null;
  }

  if (!editor.pathEditingNodeId) {
    if (editor.selectedNodeIds.includes(hoveredNodeId)) {
      return null;
    }

    const frame = editor.getNodeRenderFrame(node.id);

    if (!frame) {
      return null;
    }

    return {
      bounds: frame.bounds,
      kind: "bounds",
      transform: frame.transform,
    };
  }

  const visualOwnerNodeId = editor.getPathEditingVisualOwnerNodeId(
    editor.pathEditingNodeId
  );

  if (
    hoveredNodeId === editor.pathEditingNodeId ||
    hoveredNodeId === visualOwnerNodeId
  ) {
    return null;
  }

  const geometry = editor.getNodeRenderGeometry(node.id);
  const frame = editor.getNodeRenderFrame(node.id);

  if (!(geometry?.paths?.length && geometry.bbox && frame?.bounds)) {
    return null;
  }

  return {
    bbox: geometry.bbox,
    bounds: frame.bounds,
    kind: "path",
    paths: geometry.paths,
    transform: frame.transform,
  };
};

export const getCanvasTransformOverlayState = (editor) => {
  const state = editor.getState();

  if (
    !(
      state.activeTool === "pointer" &&
      !state.editingNodeId &&
      !state.isTextPathPositioning
    )
  ) {
    return null;
  }

  const visibleSelectedNodeIds = getVisibleSelectedNodeIds(editor);
  const effectiveSelectedNodeIds = editor
    .getEffectiveSelectionNodeIds(state.selectedNodeIds)
    .filter((nodeId) => editor.isNodeEffectivelyVisible(nodeId));
  const selectedNode =
    visibleSelectedNodeIds.length === 1
      ? editor.getNode(visibleSelectedNodeIds[0])
      : null;
  const selectedEditCapabilities = selectedNode?.id
    ? editor.getNodeEditCapabilities(selectedNode.id)
    : null;
  const selectedBounds = editor.getSelectionBounds(effectiveSelectedNodeIds);
  const hasGroupSelection =
    effectiveSelectedNodeIds.length > 1 ||
    Boolean(selectedNode?.id && isGroupNode(selectedNode));
  const isPathEditingSelection = Boolean(
    !hasGroupSelection &&
      selectedNode?.id &&
      state.pathEditingNodeId === selectedNode.id
  );
  const { isDraggable, isResizable, isRotatable } = getTransformFlags({
    activeTool: state.activeTool,
    editingNodeId: state.editingNodeId,
    hasGroupSelection,
    isPathEditingSelection,
    isTextPathPositioning: state.isTextPathPositioning,
    selectedBounds,
    selectedEditCapabilities,
    selectedNode,
  });

  if (
    isPathEditingSelection &&
    selectedEditCapabilities?.pathEditingOverlayMode === "replace-transform"
  ) {
    return null;
  }

  let mode: "multi" | "single" | null = null;

  if (hasGroupSelection) {
    mode = visibleSelectedNodeIds.length > 0 ? "multi" : null;
  } else if (selectedNode?.id) {
    mode = "single";
  }

  if (!mode) {
    return null;
  }

  return {
    isDraggable,
    isResizable,
    isRotatable,
    mode,
    nodeIds: visibleSelectedNodeIds,
    selectedGroupNodeId:
      selectedNode && isContainerNode(selectedNode) ? selectedNode.id : null,
    selectedNodeId: selectedNode?.id || null,
    selectionGhost: selectedNode?.id
      ? getSelectionGhostPreview(editor, selectedNode.id)
      : null,
  };
};

export const getTextPathOverlayState = (editor) => {
  const state = editor.getState();

  if (state.editingNodeId) {
    return null;
  }

  const visibleSelectedNodeIds = getVisibleSelectedNodeIds(editor);

  if (visibleSelectedNodeIds.length !== 1) {
    return null;
  }

  const node = editor.getNode(visibleSelectedNodeIds[0]);

  if (node?.type !== "text") {
    return null;
  }

  const geometry = editor.getNodeGeometry(node.id);

  if (!geometry?.guide) {
    return null;
  }

  return {
    geometry,
    isPathEditing: state.pathEditingNodeId === node.id,
    isTextPathPositioning: state.isTextPathPositioning,
    isSelectionRotating: state.isSelectionRotating,
    node,
    previewDelta:
      editor.getSelectionPreviewDelta(visibleSelectedNodeIds) || null,
  };
};

export const getVectorPathOverlayState = (editor) => {
  const state = editor.getState();

  if (state.editingNodeId || !state.pathEditingNodeId) {
    return null;
  }

  const editablePathSession = editor.getEditablePathSession(
    state.pathEditingNodeId
  );

  if (editablePathSession?.backend !== "vector-path") {
    return null;
  }

  const node = editor.getNode(editablePathSession.nodeId);

  if (!(node && editor.isNodeEffectivelyVisible(node.id))) {
    return null;
  }

  const geometry = editor.getNodeGeometry(node.id);

  if (!geometry?.bbox) {
    return null;
  }

  const penPreview = editor.getPenPreviewState();
  const penHover = editor.getPenHoverState();

  return {
    editablePathSession,
    geometry,
    isPathEditing: true,
    node,
    penHover:
      !state.spacePressed && penHover?.nodeId === node.id ? penHover : null,
    penPreview:
      !state.spacePressed &&
      penPreview?.nodeId === node.id &&
      penPreview.kind === "segment"
        ? penPreview
        : null,
    previewDelta: editor.getSelectionPreviewDelta([node.id]) || null,
  };
};
