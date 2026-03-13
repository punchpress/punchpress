import { createDefaultNode } from "../../shapes/warp-text/model";
import {
  deleteNodeState,
  deleteNodesState,
  duplicateNodesState,
  toggleNodeVisibilityState,
} from "./document-state";
import {
  mapNodeById,
  mapNodesByIds,
  orderNodesByIds,
  withDocumentMutation,
} from "./node-mutations";
import {
  getSelectedNodeIds,
  moveNodesToBoundaryState,
} from "./selection-state";

export const createDocumentStoreActions = (set, resolveDefaultFont) => {
  return {
    addTextNode: (point, font) => {
      const node = createDefaultNode(font || resolveDefaultFont());

      if (point) {
        node.transform = {
          ...node.transform,
          x: point.x,
          y: point.y,
        };
      }

      set((state) =>
        withDocumentMutation(state, {
          activeTool: "text",
          editingNodeId: node.id,
          editingOriginalText: node.text,
          editingText: node.text,
          nodes: [...state.nodes, node],
          selectedNodeIds: [node.id],
        })
      );
    },

    deleteSelected: () => {
      set((state) => {
        if (state.selectedNodeIds.length === 0) {
          return {};
        }

        return withDocumentMutation(
          state,
          deleteNodesState(state, state.selectedNodeIds)
        );
      });
    },

    deleteNodeById: (nodeId) => {
      set((state) => {
        return withDocumentMutation(state, deleteNodeState(state, nodeId));
      });
    },

    duplicateNodeById: (nodeId) => {
      set((state) => {
        return withDocumentMutation(
          state,
          duplicateNodesState(state, [nodeId])
        );
      });
    },

    duplicateSelectedNodes: () => {
      set((state) => {
        return withDocumentMutation(
          state,
          duplicateNodesState(state, state.selectedNodeIds)
        );
      });
    },

    loadNodes: (nodes) => {
      set((state) => ({
        activeTool: "pointer",
        editingNodeId: null,
        editingOriginalText: "",
        editingText: "",
        hoveredNodeId: null,
        isHoveringSuppressed: false,
        nodes: [...nodes],
        selectedNodeIds: [],
        viewport: state.viewport,
      }));
    },

    sendNodeToBack: (nodeId) => {
      set((state) => {
        return withDocumentMutation(
          state,
          moveNodesToBoundaryState(state, [nodeId], "back")
        );
      });
    },

    sendSelectedNodesToBack: () => {
      set((state) => {
        return withDocumentMutation(
          state,
          moveNodesToBoundaryState(state, state.selectedNodeIds, "back")
        );
      });
    },

    toggleNodeVisibilityById: (nodeId) => {
      set((state) => {
        return withDocumentMutation(
          state,
          toggleNodeVisibilityState(state, nodeId)
        );
      });
    },

    setNodeOrder: (orderedIds) => {
      set((state) =>
        withDocumentMutation(state, {
          nodes: orderNodesByIds(state.nodes, orderedIds),
        })
      );
    },

    updateNodeById: (nodeId, updater) => {
      set((state) =>
        withDocumentMutation(state, {
          nodes: mapNodeById(state.nodes, nodeId, updater),
        })
      );
    },

    updateNodesById: (nodeIds, updater) => {
      set((state) =>
        withDocumentMutation(state, {
          nodes: mapNodesByIds(
            state.nodes,
            getSelectedNodeIds(state, nodeIds),
            updater
          ),
        })
      );
    },

    updateSelectedNode: (updater) => {
      set((state) => {
        if (state.selectedNodeIds.length === 0) {
          return {};
        }

        return withDocumentMutation(state, {
          nodes: mapNodesByIds(state.nodes, state.selectedNodeIds, updater),
        });
      });
    },

    bringNodeToFront: (nodeId) => {
      set((state) => {
        return withDocumentMutation(
          state,
          moveNodesToBoundaryState(state, [nodeId], "front")
        );
      });
    },

    bringSelectedNodesToFront: () => {
      set((state) => {
        return withDocumentMutation(
          state,
          moveNodesToBoundaryState(state, state.selectedNodeIds, "front")
        );
      });
    },
  };
};
