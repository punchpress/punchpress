import { getSubtreeNodeIds, isDescendantOf } from "../../nodes/node-tree";
import { isNodeVisible } from "../../nodes/text/model";
import { finalizeEditingState } from "./editing-state";
import { exitPathEditingInteractionState } from "./interaction-state";
import {
  deleteNodeTreeState,
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
  const isPathEditingNode =
    state.pathEditingNodeId && deletedNodeIds.has(state.pathEditingNodeId);

  return {
    activeTool: isEditingNode ? "pointer" : state.activeTool,
    editingNodeId: isEditingNode ? null : state.editingNodeId,
    editingOriginalText: isEditingNode ? "" : state.editingOriginalText,
    editingText: isEditingNode ? "" : state.editingText,
    ...(isEditingNode || isPathEditingNode
      ? exitPathEditingInteractionState()
      : {}),
    isHoveringSuppressed:
      isEditingNode || isPathEditingNode ? false : state.isHoveringSuppressed,
    pathEditingNodeId:
      isEditingNode || isPathEditingNode ? null : state.pathEditingNodeId,
    ...deleteNodeTreeState(state, [nodeId]),
  };
};

export const deleteNodesState = (state, nodeIds) => {
  const selectedNodeIds = getSelectedNodeIds(state, nodeIds);

  if (selectedNodeIds.length === 0) {
    return {};
  }

  const isEditingNodeSelected =
    state.editingNodeId &&
    selectedNodeIds.some(
      (nodeId) =>
        nodeId === state.editingNodeId ||
        isDescendantOf(state.nodes, state.editingNodeId, nodeId)
    );
  const isPathEditingNodeSelected =
    state.pathEditingNodeId &&
    selectedNodeIds.some(
      (nodeId) =>
        nodeId === state.pathEditingNodeId ||
        isDescendantOf(state.nodes, state.pathEditingNodeId, nodeId)
    );

  return {
    activeTool: isEditingNodeSelected ? "pointer" : state.activeTool,
    editingNodeId: isEditingNodeSelected ? null : state.editingNodeId,
    editingOriginalText: isEditingNodeSelected ? "" : state.editingOriginalText,
    editingText: isEditingNodeSelected ? "" : state.editingText,
    ...(isEditingNodeSelected || isPathEditingNodeSelected
      ? exitPathEditingInteractionState()
      : {}),
    isHoveringSuppressed:
      isEditingNodeSelected || isPathEditingNodeSelected
        ? false
        : state.isHoveringSuppressed,
    pathEditingNodeId: isPathEditingNodeSelected
      ? null
      : state.pathEditingNodeId,
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
    pathEditingNodeId: baseState.pathEditingNodeId,
    ...toggleNodeVisibilityTreeState(baseState, nodeId),
    selectedNodeIds: baseState.selectedNodeIds,
  };
};
