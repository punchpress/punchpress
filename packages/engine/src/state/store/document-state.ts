import {
  getSubtreeNodeIds,
  isDescendantOf,
} from "../../nodes/node-tree";
import { isNodeVisible } from "../../shapes/warp-text/model";
import { finalizeEditingState } from "./editing-state";
import {
  deleteNodeTreeState,
  duplicateNodeTreeState,
  toggleNodeVisibilityTreeState,
} from "./node-tree-state";
import { getSelectedNodeIds } from "./selection-state";

export const deleteNodeState = (state, nodeId) => {
  if (!nodeId) {
    return {};
  }

  const deletedNodeIds = new Set(getSubtreeNodeIds(state.nodes, nodeId));
  const isEditingNode =
    state.editingNodeId && deletedNodeIds.has(state.editingNodeId);

  return {
    activeTool: isEditingNode ? "pointer" : state.activeTool,
    editingNodeId: isEditingNode ? null : state.editingNodeId,
    editingOriginalText: isEditingNode ? "" : state.editingOriginalText,
    editingText: isEditingNode ? "" : state.editingText,
    isHoveringSuppressed: isEditingNode ? false : state.isHoveringSuppressed,
    ...deleteNodeTreeState(state, [nodeId]),
  };
};

export const deleteNodesState = (state, nodeIds) => {
  const selectedNodeIds = getSelectedNodeIds(state, nodeIds);

  if (selectedNodeIds.length === 0) {
    return {};
  }

  const selectedNodeIdSet = new Set(selectedNodeIds);
  const isEditingNodeSelected =
    state.editingNodeId &&
    selectedNodeIds.some((nodeId) =>
      nodeId === state.editingNodeId ||
      isDescendantOf(state.nodes, state.editingNodeId, nodeId)
    );

  return {
    activeTool: isEditingNodeSelected ? "pointer" : state.activeTool,
    editingNodeId: isEditingNodeSelected ? null : state.editingNodeId,
    editingOriginalText: isEditingNodeSelected ? "" : state.editingOriginalText,
    editingText: isEditingNodeSelected ? "" : state.editingText,
    isHoveringSuppressed: isEditingNodeSelected
      ? false
      : state.isHoveringSuppressed,
    ...deleteNodeTreeState(state, selectedNodeIds),
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
    !nextVisible &&
    state.editingNodeId &&
    (state.editingNodeId === nodeId ||
      isDescendantOf(state.nodes, state.editingNodeId, nodeId))
      ? { ...state, ...finalizeEditingState(state, state.selectedNodeIds) }
      : state;

  return {
    activeTool: baseState.activeTool,
    editingNodeId: baseState.editingNodeId,
    editingOriginalText: baseState.editingOriginalText,
    editingText: baseState.editingText,
    ...toggleNodeVisibilityTreeState(baseState, nodeId),
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
  const duplicatedState = duplicateNodeTreeState(committedState, selectedNodeIds);

  return {
    activeTool: committedState.activeTool,
    editingNodeId: committedState.editingNodeId,
    editingOriginalText: committedState.editingOriginalText,
    editingText: committedState.editingText,
    ...duplicatedState,
  };
};
