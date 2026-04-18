import { commitEditingState, finalizeEditingState } from "./editing-state";
import {
  enterTextEditingInteractionState,
  exitPathEditingInteractionState,
  resetTransientCanvasInteractionState,
} from "./interaction-state";
import { mapNodeById, withDocumentMutation } from "./node-mutations";
import { getSelectedNodeIds } from "./selection-state";

const shouldPreservePathEditingSelection = (state, nextSelectedNodeIds) => {
  if (!(state.pathEditingNodeId && nextSelectedNodeIds.length === 1)) {
    return false;
  }

  return nextSelectedNodeIds[0] === state.pathEditingNodeId;
};

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
          ...resetTransientCanvasInteractionState(),
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
          ...exitPathEditingInteractionState(),
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
          ...enterTextEditingInteractionState(),
          selectedNodeIds: [node.id],
        });
      });
    },

    selectNode: (nodeId) => {
      set((state) => {
        const nextSelectedNodeIds = getSelectedNodeIds(state, [nodeId]);
        const preservesPathEditing = shouldPreservePathEditingSelection(
          state,
          nextSelectedNodeIds
        );

        if (state.editingNodeId && state.editingNodeId !== nodeId) {
          return withDocumentMutation(
            state,
            commitEditingState(state, nextSelectedNodeIds)
          );
        }

        return {
          ...(preservesPathEditing ? {} : exitPathEditingInteractionState()),
          pathEditingNodeId: preservesPathEditing
            ? state.pathEditingNodeId
            : null,
          pathEditingPoint: preservesPathEditing
            ? state.pathEditingPoint
            : null,
          pathEditingPoints: preservesPathEditing
            ? state.pathEditingPoints
            : [],
          selectedNodeIds: nextSelectedNodeIds,
        };
      });
    },

    selectNodes: (nodeIds) => {
      set((state) => {
        const nextSelectedNodeIds = getSelectedNodeIds(state, nodeIds);
        const preservesPathEditing = shouldPreservePathEditingSelection(
          state,
          nextSelectedNodeIds
        );

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
          ...(preservesPathEditing ? {} : exitPathEditingInteractionState()),
          pathEditingNodeId: preservesPathEditing
            ? state.pathEditingNodeId
            : null,
          pathEditingPoint: preservesPathEditing
            ? state.pathEditingPoint
            : null,
          pathEditingPoints: preservesPathEditing
            ? state.pathEditingPoints
            : [],
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
        const preservesPathEditing = shouldPreservePathEditingSelection(
          state,
          nextSelectedNodeIds
        );

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
          ...(preservesPathEditing ? {} : exitPathEditingInteractionState()),
          pathEditingNodeId: preservesPathEditing
            ? state.pathEditingNodeId
            : null,
          pathEditingPoint: preservesPathEditing
            ? state.pathEditingPoint
            : null,
          pathEditingPoints: preservesPathEditing
            ? state.pathEditingPoints
            : [],
          selectedNodeIds: nextSelectedNodeIds,
        };
      });
    },
  };
};
