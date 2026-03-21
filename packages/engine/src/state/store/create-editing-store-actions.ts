import { commitEditingState, finalizeEditingState } from "./editing-state";
import { mapNodeById, withDocumentMutation } from "./node-mutations";
import { getSelectedNodeIds } from "./selection-state";

export const createEditingStoreActions = (set) => {
  return {
    cancelEditing: () => {
      set((state) => {
        if (!state.editingNodeId) {
          return {};
        }

        return withDocumentMutation(state, {
          editingNodeId: null,
          editingOriginalText: "",
          editingText: state.editingOriginalText,
          isHoveringSuppressed: false,
          nodes: mapNodeById(state.nodes, state.editingNodeId, {
            text: state.editingOriginalText,
          }),
        });
      });
    },

    clearSelection: () => {
      set((state) => {
        if (state.editingNodeId) {
          return withDocumentMutation(state, commitEditingState(state, []));
        }

        return {
          pathEditingNodeId: null,
          selectedNodeIds: [],
        };
      });
    },

    commitEditing: () => {
      set((state) => {
        return withDocumentMutation(state, commitEditingState(state));
      });
    },

    setEditingText: (value) => {
      set((state) => {
        if (!state.editingNodeId) {
          return {
            editingText: value,
          };
        }

        return withDocumentMutation(state, {
          editingText: value,
          nodes: mapNodeById(state.nodes, state.editingNodeId, {
            text: value.length > 0 ? value : " ",
          }),
        });
      });
    },

    startEditing: (node) => {
      set((state) => {
        if (!(node && node.type === "text")) {
          return {};
        }

        const baseState =
          state.editingNodeId && state.editingNodeId !== node.id
            ? commitEditingState(state, [node.id])
            : {};

        return withDocumentMutation(state, {
          ...baseState,
          activeTool: "pointer",
          editingNodeId: node.id,
          editingOriginalText: node.text,
          editingText: node.text,
          isHoveringSuppressed: true,
          pathEditingNodeId: null,
          selectedNodeIds: [node.id],
        });
      });
    },

    selectNode: (nodeId) => {
      set((state) => {
        const nextSelectedNodeIds = getSelectedNodeIds(state, [nodeId]);

        if (state.editingNodeId && state.editingNodeId !== nodeId) {
          return withDocumentMutation(
            state,
            commitEditingState(state, nextSelectedNodeIds)
          );
        }

        return {
          pathEditingNodeId:
            state.pathEditingNodeId === nodeId ? state.pathEditingNodeId : null,
          selectedNodeIds: nextSelectedNodeIds,
        };
      });
    },

    selectNodes: (nodeIds) => {
      set((state) => {
        const nextSelectedNodeIds = getSelectedNodeIds(state, nodeIds);

        if (
          state.editingNodeId &&
          (nextSelectedNodeIds.length !== 1 ||
            nextSelectedNodeIds[0] !== state.editingNodeId)
        ) {
          return withDocumentMutation(
            state,
            finalizeEditingState(state, nextSelectedNodeIds)
          );
        }

        return {
          pathEditingNodeId:
            nextSelectedNodeIds.length === 1 &&
            nextSelectedNodeIds[0] === state.pathEditingNodeId
              ? state.pathEditingNodeId
              : null,
          selectedNodeIds: nextSelectedNodeIds,
        };
      });
    },

    toggleNodeSelection: (nodeId) => {
      set((state) => {
        const nextSelectedNodeIds = state.selectedNodeIds.includes(nodeId)
          ? state.selectedNodeIds.filter(
              (selectedNodeId) => selectedNodeId !== nodeId
            )
          : getSelectedNodeIds(state, [...state.selectedNodeIds, nodeId]);

        if (
          state.editingNodeId &&
          (nextSelectedNodeIds.length !== 1 ||
            nextSelectedNodeIds[0] !== state.editingNodeId)
        ) {
          return withDocumentMutation(
            state,
            finalizeEditingState(state, nextSelectedNodeIds)
          );
        }

        return {
          pathEditingNodeId:
            nextSelectedNodeIds.length === 1 &&
            nextSelectedNodeIds[0] === state.pathEditingNodeId
              ? state.pathEditingNodeId
              : null,
          selectedNodeIds: nextSelectedNodeIds,
        };
      });
    },
  };
};
