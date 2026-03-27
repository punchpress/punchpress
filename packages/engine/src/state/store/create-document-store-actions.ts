import { createDefaultShapeNode } from "../../nodes/shape/model";
import { createDefaultNode } from "../../nodes/text/model";
import { createDefaultVectorNode } from "../../nodes/vector/model";
import {
  insertClipboardContentState,
  pasteClipboardContentState,
  pasteTextState,
} from "./clipboard-state";
import {
  deleteNodeState,
  deleteNodesState,
  reconcilePathEditingState,
  toggleNodeVisibilityState,
} from "./document-state";
import { exitPathEditingInteractionState } from "./interaction-state";
import {
  mapNodeById,
  mapNodesByIds,
  withDocumentMutation,
} from "./node-mutations";
import {
  groupNodeTreeState,
  setChildNodeOrderState,
  setRootNodeOrderState,
  ungroupNodeTreeState,
} from "./node-tree-state";
import {
  getSelectedNodeIds,
  moveNodesToBoundaryState,
} from "./selection-state";

export const createDocumentStoreActions = (set, resolveDefaultFont) => {
  return {
    addShapeNode: (point, shape, options = {}) => {
      const node = createDefaultShapeNode(shape);
      const activatePointer = options.activatePointer !== false;
      const nodePatch = options.patch || null;

      if (point) {
        node.transform = {
          ...node.transform,
          x: point.x,
          y: point.y,
        };
      }

      if (nodePatch) {
        Object.assign(node, nodePatch);

        if (nodePatch.transform) {
          node.transform = {
            ...node.transform,
            ...nodePatch.transform,
          };
        }
      }

      set((state) =>
        withDocumentMutation(state, {
          activeTool: activatePointer ? "pointer" : state.activeTool,
          editingNodeId: null,
          editingOriginalText: "",
          editingText: "",
          focusedGroupId: null,
          nodes: [...state.nodes, node],
          pathEditingNodeId: null,
          pathEditingPoint: null,
          selectedNodeIds: [node.id],
        })
      );

      return node.id;
    },

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
          activeTool: "pointer",
          editingNodeId: node.id,
          editingOriginalText: node.text,
          editingText: node.text,
          focusedGroupId: null,
          nodes: [...state.nodes, node],
          pathEditingNodeId: null,
          pathEditingPoint: null,
          selectedNodeIds: [node.id],
        })
      );
    },

    addVectorNode: (point, options = {}) => {
      const node = createDefaultVectorNode();
      const activatePointer = options.activatePointer !== false;
      const nodePatch = options.patch || null;

      if (point) {
        node.transform = {
          ...node.transform,
          x: point.x,
          y: point.y,
        };
      }

      if (nodePatch) {
        Object.assign(node, nodePatch);

        if (nodePatch.transform) {
          node.transform = {
            ...node.transform,
            ...nodePatch.transform,
          };
        }
      }

      set((state) =>
        withDocumentMutation(state, {
          activeTool: activatePointer ? "pointer" : state.activeTool,
          editingNodeId: null,
          editingOriginalText: "",
          editingText: "",
          focusedGroupId: null,
          nodes: [...state.nodes, node],
          pathEditingNodeId: null,
          pathEditingPoint: null,
          selectedNodeIds: [node.id],
        })
      );

      return node.id;
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

    insertClipboardContent: (content, options) => {
      set((state) => {
        return withDocumentMutation(
          state,
          insertClipboardContentState(state, content, options)
        );
      });
    },

    pasteClipboardContent: (content, offset) => {
      set((state) => {
        return withDocumentMutation(
          state,
          pasteClipboardContentState(state, content, { offset })
        );
      });
    },

    pasteText: (text, font, point) => {
      set((state) => {
        return withDocumentMutation(
          state,
          pasteTextState(state, text, font, point)
        );
      });
    },

    loadNodes: (nodes) => {
      set((state) => ({
        activeTool: "pointer",
        editingNodeId: null,
        editingOriginalText: "",
        editingText: "",
        focusedGroupId: null,
        hoveredNodeId: null,
        ...exitPathEditingInteractionState(),
        nodes: [...nodes],
        pathEditingNodeId: null,
        pathEditingPoint: null,
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

    setNodeOrder: (orderedIds, parentId) => {
      set((state) =>
        withDocumentMutation(state, {
          ...(parentId
            ? setChildNodeOrderState(state, parentId, orderedIds)
            : setRootNodeOrderState(state, orderedIds)),
        })
      );
    },

    updateNodeById: (nodeId, updater) => {
      set((state) => {
        const nodes = mapNodeById(state.nodes, nodeId, updater);

        return withDocumentMutation(
          state,
          reconcilePathEditingState(state, nodes)
        );
      });
    },

    updateNodesById: (nodeIds, updater) => {
      set((state) => {
        const nodes = mapNodesByIds(
          state.nodes,
          getSelectedNodeIds(state, nodeIds),
          updater
        );

        return withDocumentMutation(
          state,
          reconcilePathEditingState(state, nodes)
        );
      });
    },

    updateSelectedNode: (updater) => {
      set((state) => {
        if (state.selectedNodeIds.length === 0) {
          return {};
        }

        const nodes = mapNodesByIds(
          state.nodes,
          state.selectedNodeIds,
          updater
        );

        return withDocumentMutation(
          state,
          reconcilePathEditingState(state, nodes)
        );
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

    groupSelectedNodes: () => {
      set((state) => {
        return withDocumentMutation(
          state,
          groupNodeTreeState(state, state.selectedNodeIds)
        );
      });
    },

    ungroupNodeById: (nodeId) => {
      set((state) => {
        return withDocumentMutation(state, ungroupNodeTreeState(state, nodeId));
      });
    },
  };
};
