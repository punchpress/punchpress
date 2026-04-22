import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { createDefaultPathNode } from "../../nodes/path/model";
import { createDefaultShapeNode } from "../../nodes/shape/model";
import { createDefaultNode } from "../../nodes/text/model";
import { toInternalEditorNodes } from "../../nodes/vector/vector-document-conversion";
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
  moveNodeBlocksState,
  replaceNodeBlocksState,
  setChildNodeOrderState,
  setRootNodeOrderState,
  ungroupNodeTreeState,
} from "./node-tree-state";
import {
  getSelectedNodeIds,
  moveNodesToBoundaryState,
} from "./selection-state";

export const createDocumentStoreActions = (set, resolveDefaultFont) => {
  const getInsertedRootNodeIds = (nodes) => {
    const insertedNodeIds = new Set(nodes.map((node) => node.id));

    return nodes
      .filter((node) => !insertedNodeIds.has(node.parentId))
      .map((node) => node.id);
  };

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
          pathEditingPoints: [],
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
          pathEditingPoints: [],
          selectedNodeIds: [node.id],
        })
      );
    },

    addVectorNode: (point, options = {}) => {
      const node = createDefaultPathNode(ROOT_PARENT_ID);
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
        Object.assign(node, nodePatch.path || nodePatch);
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
          pathEditingPoints: [],
          selectedNodeIds: [node.id],
        })
      );

      return node.id;
    },

    addPathNode: (parentId, point, options = {}) => {
      const resolvedParentId = parentId || ROOT_PARENT_ID;
      const node = createDefaultPathNode(resolvedParentId);
      const activatePointer = options.activatePointer !== false;
      const nodePatch = options.patch || null;
      const selectionNodeId =
        options.selectionNodeId ||
        (resolvedParentId === ROOT_PARENT_ID ? node.id : resolvedParentId);

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
          focusedGroupId: state.focusedGroupId,
          nodes: [...state.nodes, node],
          pathEditingNodeId: null,
          pathEditingPoint: null,
          pathEditingPoints: [],
          selectedNodeIds: [selectionNodeId],
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

    insertNodes: (nodes) => {
      if (!Array.isArray(nodes) || nodes.length === 0) {
        return;
      }

      const normalizedNodes = toInternalEditorNodes(nodes);

      set((state) =>
        withDocumentMutation(state, {
          activeTool: "pointer",
          editingNodeId: null,
          editingOriginalText: "",
          editingText: "",
          focusedGroupId: null,
          nodes: [...state.nodes, ...normalizedNodes],
          pathEditingNodeId: null,
          pathEditingPoint: null,
          pathEditingPoints: [],
          selectedNodeIds: getInsertedRootNodeIds(normalizedNodes),
        })
      );
    },

    loadNodes: (nodes) => {
      const normalizedNodes = toInternalEditorNodes(nodes);

      set((state) => ({
        activeTool: "pointer",
        editingNodeId: null,
        editingOriginalText: "",
        editingText: "",
        focusedGroupId: null,
        hoveredNodeId: null,
        ...exitPathEditingInteractionState(),
        nodes: [...normalizedNodes],
        pathEditingNodeId: null,
        pathEditingPoint: null,
        pathEditingPoints: [],
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

    moveNodeToParent: (nodeId, parentId, beforeNodeId) => {
      set((state) =>
        withDocumentMutation(
          state,
          moveNodeBlocksState(state, [nodeId], parentId, beforeNodeId)
        )
      );
    },

    replaceNodeBlocks: (nodeIds, insertedNodes) => {
      if (!(Array.isArray(insertedNodes) && insertedNodes.length > 0)) {
        return;
      }

      set((state) =>
        withDocumentMutation(
          state,
          replaceNodeBlocksState(state, nodeIds, insertedNodes)
        )
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
