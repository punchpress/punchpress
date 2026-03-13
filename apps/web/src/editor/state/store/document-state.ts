import { createId, isNodeVisible } from "../../shapes/warp-text/model";
import { finalizeEditingState } from "./editing-state";
import { mapNodeById } from "./node-mutations";
import { getSelectedNodeIds } from "./selection-state";

export const deleteNodeState = (state, nodeId) => {
  if (!nodeId) {
    return {};
  }

  const isEditingNode = state.editingNodeId === nodeId;

  return {
    activeTool: isEditingNode ? "pointer" : state.activeTool,
    editingNodeId: isEditingNode ? null : state.editingNodeId,
    editingOriginalText: isEditingNode ? "" : state.editingOriginalText,
    editingText: isEditingNode ? "" : state.editingText,
    isHoveringSuppressed: isEditingNode ? false : state.isHoveringSuppressed,
    nodes: state.nodes.filter((node) => node.id !== nodeId),
    selectedNodeIds: state.selectedNodeIds.filter(
      (selectedNodeId) => selectedNodeId !== nodeId
    ),
  };
};

export const deleteNodesState = (state, nodeIds) => {
  const selectedNodeIds = getSelectedNodeIds(state, nodeIds);

  if (selectedNodeIds.length === 0) {
    return {};
  }

  const selectedNodeIdSet = new Set(selectedNodeIds);
  const isEditingNodeSelected =
    state.editingNodeId && selectedNodeIdSet.has(state.editingNodeId);

  return {
    activeTool: isEditingNodeSelected ? "pointer" : state.activeTool,
    editingNodeId: isEditingNodeSelected ? null : state.editingNodeId,
    editingOriginalText: isEditingNodeSelected ? "" : state.editingOriginalText,
    editingText: isEditingNodeSelected ? "" : state.editingText,
    isHoveringSuppressed: isEditingNodeSelected
      ? false
      : state.isHoveringSuppressed,
    nodes: state.nodes.filter((node) => !selectedNodeIdSet.has(node.id)),
    selectedNodeIds: state.selectedNodeIds.filter(
      (selectedNodeId) => !selectedNodeIdSet.has(selectedNodeId)
    ),
  };
};

export const toggleNodeVisibilityState = (state, nodeId) => {
  if (!nodeId) {
    return {};
  }

  const targetNode = state.nodes.find((node) => node.id === nodeId);
  if (!targetNode) {
    return {};
  }

  const nextVisible = !isNodeVisible(targetNode);
  const baseState =
    !nextVisible && state.editingNodeId === nodeId
      ? { ...state, ...finalizeEditingState(state, state.selectedNodeIds) }
      : state;

  return {
    activeTool: baseState.activeTool,
    editingNodeId: baseState.editingNodeId,
    editingOriginalText: baseState.editingOriginalText,
    editingText: baseState.editingText,
    nodes: mapNodeById(baseState.nodes, nodeId, {
      visible: nextVisible,
    }),
    selectedNodeIds: baseState.selectedNodeIds,
  };
};

export const duplicateNodesState = (state, nodeIds) => {
  const selectedNodeIds = getSelectedNodeIds(state, nodeIds);

  if (selectedNodeIds.length === 0) {
    return {};
  }

  const committedState =
    state.editingNodeId && selectedNodeIds.includes(state.editingNodeId)
      ? { ...state, ...finalizeEditingState(state, selectedNodeIds) }
      : state;
  const selectedNodeIdSet = new Set(selectedNodeIds);
  const duplicateNodeIds = /** @type {string[]} */ ([]);
  const nodes = committedState.nodes.flatMap((node) => {
    if (!selectedNodeIdSet.has(node.id)) {
      return [node];
    }

    const duplicateNode = {
      ...node,
      id: createId(),
      transform: {
        ...node.transform,
        x: node.transform.x + 120,
        y: node.transform.y + 120,
      },
    };

    duplicateNodeIds.push(duplicateNode.id);

    return [node, duplicateNode];
  });

  return {
    activeTool: committedState.activeTool,
    editingNodeId: committedState.editingNodeId,
    editingOriginalText: committedState.editingOriginalText,
    editingText: committedState.editingText,
    nodes,
    selectedNodeIds: duplicateNodeIds,
  };
};
