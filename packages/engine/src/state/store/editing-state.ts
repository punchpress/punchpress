import { resetTransientCanvasInteractionState } from "./interaction-state";
import { mapNodeById } from "./node-mutations";
import { getSelectedNodeIds } from "./selection-state";

const toCommittedText = (value) => {
  return value.trim().length > 0 ? value : " ";
};

export const commitEditingState = (
  state,
  selectedNodeIds = state.selectedNodeIds
) => {
  if (!state.editingNodeId) {
    return {
      ...resetTransientCanvasInteractionState(),
      selectedNodeIds: getSelectedNodeIds(state, selectedNodeIds),
    };
  }

  const nextText = toCommittedText(state.editingText);

  return {
    editingNodeId: null,
    editingOriginalText: "",
    editingText: nextText,
    ...resetTransientCanvasInteractionState(),
    nodes: mapNodeById(state.nodes, state.editingNodeId, (node) =>
      node.text === nextText ? node : { ...node, text: nextText }
    ),
    selectedNodeIds: getSelectedNodeIds(state, selectedNodeIds),
  };
};

export const finalizeEditingState = (
  state,
  selectedNodeIds = state.selectedNodeIds
) => {
  return {
    ...commitEditingState(state, selectedNodeIds),
    activeTool: "pointer",
  };
};
