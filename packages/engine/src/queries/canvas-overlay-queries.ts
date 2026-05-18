import {
  isArtboardNode,
  isContainerNode,
  isGroupNode,
} from "../nodes/node-tree";
import { format } from "../primitives/math";
import {
  getNodeTransformFrame as getPrimitiveNodeTransformFrame,
  getWorldPointFromTransformFrame,
  rotatePointAround,
} from "../primitives/rotation";

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
  hasArtboardSelection,
  hasGroupSelection,
  isPathEditingSelection,
  isTextPathPositioning,
  selectedBounds,
  selectedEditCapabilities,
  selectedNode,
}) => {
  const canTransform =
    activeTool === "pointer" ||
    (activeTool === "node" &&
      isPathEditingSelection &&
      selectedEditCapabilities?.pathEditingOverlayMode === "keep-transform");

  if (isArtboardNode(selectedNode)) {
    return {
      isDraggable: false,
      isResizable: Boolean(canTransform && selectedNode && !editingNodeId),
      isRotatable: false,
    };
  }

  if (isPathEditingSelection) {
    return {
      isDraggable: false,
      isResizable: Boolean(
        canTransform &&
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
      canTransform && Boolean(selectedNode || hasGroupSelection) && !editingNodeId
    ),
    isResizable: Boolean(
      canTransform &&
        (hasGroupSelection ? selectedBounds : selectedNode) &&
        (hasGroupSelection || (selectedNode && selectedEditCapabilities)) &&
        !editingNodeId
    ),
    isRotatable: Boolean(
      canTransform &&
        !hasArtboardSelection &&
        (hasGroupSelection ? selectedBounds : selectedEditCapabilities) &&
        !editingNodeId
    ),
  };
};

const getFrameRotationDegrees = (frame) => {
  const match =
    typeof frame?.transform === "string"
      ? frame.transform.match(/^rotate\((-?\d+(?:\.\d+)?)deg\)$/)
      : null;

  return match ? Number.parseFloat(match[1]) : 0;
};

const getFrameCenter = (frame) => {
  return {
    x: frame.bounds.minX + frame.bounds.width / 2,
    y: frame.bounds.minY + frame.bounds.height / 2,
  };
};

const buildVectorChildGhostTransform = ({
  childFrame,
  frame,
  parentFrame,
}) => {
  const rotation = getFrameRotationDegrees(frame);
  const frameCenter = getFrameCenter(frame);
  const toOverlayPoint = (point) => {
    const childPoint = getWorldPointFromTransformFrame(childFrame, point);
    const worldPoint = getWorldPointFromTransformFrame(parentFrame, childPoint);
    const unrotatedPoint = rotatePointAround(
      worldPoint,
      frameCenter,
      -rotation
    );

    return {
      x: unrotatedPoint.x - frame.bounds.minX,
      y: unrotatedPoint.y - frame.bounds.minY,
    };
  };
  const origin = toOverlayPoint({ x: 0, y: 0 });
  const xAxis = toOverlayPoint({ x: 1, y: 0 });
  const yAxis = toOverlayPoint({ x: 0, y: 1 });
  const a = xAxis.x - origin.x;
  const b = xAxis.y - origin.y;
  const c = yAxis.x - origin.x;
  const d = yAxis.y - origin.y;

  return `matrix(${format(a)} ${format(b)} ${format(c)} ${format(d)} ${format(origin.x)} ${format(origin.y)})`;
};

const getVectorChildSelectionGhostPreview = ({
  editor,
  geometry,
  node,
  parentNode,
}) => {
  const parentGeometry = editor.getNodeRenderGeometry(parentNode.id);
  const frame = editor.getNodeTransformFrame(node.id);

  if (!(parentGeometry?.bbox && frame?.bounds)) {
    return null;
  }

  const childFrame = getPrimitiveNodeTransformFrame(node, geometry.bbox);
  const parentFrame = getPrimitiveNodeTransformFrame(
    parentNode,
    parentGeometry.bbox
  );
  const transform = buildVectorChildGhostTransform({
    childFrame,
    frame,
    parentFrame,
  });

  return {
    bbox: {
      height: frame.bounds.height,
      maxX: frame.bounds.width,
      maxY: frame.bounds.height,
      minX: 0,
      minY: 0,
      width: frame.bounds.width,
    },
    nodeId: node.id,
    paths: geometry.paths.map((path) => ({
      ...path,
      transform,
    })),
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

  const vectorChildGhost = getVectorChildSelectionGhostPreview({
    editor,
    geometry,
    node,
    parentNode,
  });

  if (vectorChildGhost) {
    return vectorChildGhost;
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
  const canShowHoverPreview =
    editor.activeTool === "pointer" ||
    (editor.activeTool === "node" && Boolean(editor.pathEditingNodeId));

  if (
    state.spacePressed ||
    !canShowHoverPreview ||
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

    const frame = editor.getNodeFrame(node.id);

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
      (state.activeTool === "pointer" || state.activeTool === "node") &&
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
  const hasArtboardSelection = visibleSelectedNodeIds.some((nodeId) => {
    return editor.isArtboardNode(nodeId);
  });
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
    hasArtboardSelection,
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

  if (
    state.activeTool === "node" &&
    !(
      isPathEditingSelection &&
      selectedEditCapabilities?.pathEditingOverlayMode === "keep-transform"
    )
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
