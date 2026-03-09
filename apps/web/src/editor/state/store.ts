import createStore from "zustand/vanilla";
import { FALLBACK_FONTS } from "../constants";
import {
  createDefaultNode,
  createId,
  isNodeVisible,
} from "../shapes/warp-text/model";

const toCommittedText = (value) => {
  return value.trim().length > 0 ? value : " ";
};

const applyNodeUpdate = (node, updater) => {
  if (typeof updater === "function") {
    return updater(node);
  }

  return {
    ...node,
    ...updater,
  };
};

const mapNodeById = (nodes, targetId, updater) => {
  return nodes.map((node) => {
    if (node.id !== targetId) {
      return node;
    }

    return applyNodeUpdate(node, updater);
  });
};

const orderNodesByIds = (nodes, orderedIds) => {
  if (orderedIds.length !== nodes.length) {
    return nodes;
  }

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const orderedNodes = orderedIds
    .map((nodeId) => nodesById.get(nodeId))
    .filter(Boolean);

  return orderedNodes.length === nodes.length ? orderedNodes : nodes;
};

const commitEditingState = (state, selectedNodeId = state.selectedNodeId) => {
  if (!state.editingNodeId) {
    return {
      selectedNodeId,
    };
  }

  const nextText = toCommittedText(state.editingText);

  return {
    editingNodeId: null,
    editingOriginalText: "",
    editingText: nextText,
    nodes: mapNodeById(state.nodes, state.editingNodeId, (node) =>
      node.text === nextText ? node : { ...node, text: nextText }
    ),
    selectedNodeId,
  };
};

const finalizeEditingState = (state, selectedNodeId = state.selectedNodeId) => {
  return {
    ...commitEditingState(state, selectedNodeId),
    activeTool: "pointer",
  };
};

const deleteNodeState = (state, nodeId) => {
  if (!nodeId) {
    return {};
  }

  const isEditingNode = state.editingNodeId === nodeId;

  return {
    activeTool: isEditingNode ? "pointer" : state.activeTool,
    editingNodeId: isEditingNode ? null : state.editingNodeId,
    editingOriginalText: isEditingNode ? "" : state.editingOriginalText,
    editingText: isEditingNode ? "" : state.editingText,
    nodes: state.nodes.filter((node) => node.id !== nodeId),
    selectedNodeId:
      state.selectedNodeId === nodeId ? null : state.selectedNodeId,
  };
};

const toggleNodeVisibilityState = (state, nodeId) => {
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
      ? { ...state, ...finalizeEditingState(state, state.selectedNodeId) }
      : state;

  return {
    activeTool: baseState.activeTool,
    editingNodeId: baseState.editingNodeId,
    editingOriginalText: baseState.editingOriginalText,
    editingText: baseState.editingText,
    nodes: mapNodeById(baseState.nodes, nodeId, {
      visible: nextVisible,
    }),
    selectedNodeId: baseState.selectedNodeId,
  };
};

export const createEditorStore = ({
  fonts = FALLBACK_FONTS,
  initialZoom = 1,
} = {}) => {
  const resolveDefaultFontUrl = () => {
    return fonts[0]?.url || FALLBACK_FONTS[0].url;
  };

  return createStore((set) => ({
    activeTool: "pointer",
    editingNodeId: null,
    editingOriginalText: "",
    editingText: "",
    fontRevision: 0,
    nodes: [],
    selectedNodeId: null,
    viewport: {
      zoom: initialZoom,
    },

    addTextNode: (point) => {
      const node = createDefaultNode(resolveDefaultFontUrl());

      if (point) {
        node.x = point.x;
        node.y = point.y;
      }

      set((state) => ({
        activeTool: "text",
        editingNodeId: node.id,
        editingOriginalText: node.text,
        editingText: node.text,
        nodes: [...state.nodes, node],
        selectedNodeId: node.id,
      }));
    },

    bumpFontRevision: () => {
      set((state) => ({
        fontRevision: state.fontRevision + 1,
      }));
    },

    cancelEditing: () => {
      set((state) => {
        if (!state.editingNodeId) {
          return {};
        }

        return {
          editingNodeId: null,
          editingOriginalText: "",
          editingText: state.editingOriginalText,
          nodes: mapNodeById(state.nodes, state.editingNodeId, {
            text: state.editingOriginalText,
          }),
        };
      });
    },

    clearSelection: () => {
      set((state) => {
        if (state.editingNodeId) {
          return commitEditingState(state, null);
        }

        return {
          selectedNodeId: null,
        };
      });
    },

    commitEditing: () => {
      set((state) => {
        return commitEditingState(state);
      });
    },

    deleteSelected: () => {
      set((state) => {
        if (!state.selectedNodeId) {
          return {};
        }

        return deleteNodeState(state, state.selectedNodeId);
      });
    },

    deleteNodeById: (nodeId) => {
      set((state) => {
        return deleteNodeState(state, nodeId);
      });
    },

    duplicateNodeById: (nodeId) => {
      set((state) => {
        if (!nodeId) {
          return {};
        }

        const committedState =
          state.editingNodeId === nodeId
            ? { ...state, ...finalizeEditingState(state, nodeId) }
            : state;
        const nodeIndex = committedState.nodes.findIndex(
          (node) => node.id === nodeId
        );

        if (nodeIndex < 0) {
          return {};
        }

        const sourceNode = committedState.nodes[nodeIndex];
        const duplicateNode = {
          ...sourceNode,
          id: createId(),
          x: sourceNode.x + 120,
          y: sourceNode.y + 120,
        };
        const nodes = [...committedState.nodes];

        nodes.splice(nodeIndex + 1, 0, duplicateNode);

        return {
          activeTool: committedState.activeTool,
          editingNodeId: committedState.editingNodeId,
          editingOriginalText: committedState.editingOriginalText,
          editingText: committedState.editingText,
          nodes,
          selectedNodeId: duplicateNode.id,
        };
      });
    },

    selectNode: (nodeId) => {
      set((state) => {
        if (state.editingNodeId && state.editingNodeId !== nodeId) {
          return commitEditingState(state, nodeId);
        }

        return {
          selectedNodeId: nodeId,
        };
      });
    },

    setActiveTool: (activeTool) => {
      set({ activeTool });
    },

    sendNodeToBack: (nodeId) => {
      set((state) => {
        if (!nodeId) {
          return {};
        }

        const node = state.nodes.find((item) => item.id === nodeId);

        if (!node || state.nodes[0]?.id === nodeId) {
          return {};
        }

        return {
          nodes: [node, ...state.nodes.filter((item) => item.id !== nodeId)],
        };
      });
    },

    setEditingText: (value) => {
      set((state) => {
        if (!state.editingNodeId) {
          return {
            editingText: value,
          };
        }

        return {
          editingText: value,
          nodes: mapNodeById(state.nodes, state.editingNodeId, {
            text: value.length > 0 ? value : " ",
          }),
        };
      });
    },

    toggleNodeVisibilityById: (nodeId) => {
      set((state) => {
        return toggleNodeVisibilityState(state, nodeId);
      });
    },

    setNodeOrder: (orderedIds) => {
      set((state) => ({
        nodes: orderNodesByIds(state.nodes, orderedIds),
      }));
    },

    setViewportZoom: (zoom) => {
      set((state) => ({
        viewport: {
          ...state.viewport,
          zoom,
        },
      }));
    },

    startEditing: (node) => {
      set((state) => {
        const baseState =
          state.editingNodeId && state.editingNodeId !== node.id
            ? commitEditingState(state, node.id)
            : {};

        return {
          ...baseState,
          activeTool: "text",
          editingNodeId: node.id,
          editingOriginalText: node.text,
          editingText: node.text,
          selectedNodeId: node.id,
        };
      });
    },

    updateNodeById: (nodeId, updater) => {
      set((state) => ({
        nodes: mapNodeById(state.nodes, nodeId, updater),
      }));
    },

    updateSelectedNode: (updater) => {
      set((state) => {
        if (!state.selectedNodeId) {
          return {};
        }

        return {
          nodes: mapNodeById(state.nodes, state.selectedNodeId, updater),
        };
      });
    },

    bringNodeToFront: (nodeId) => {
      set((state) => {
        if (!nodeId) {
          return {};
        }

        const node = state.nodes.find((item) => item.id === nodeId);

        if (!node || state.nodes.at(-1)?.id === nodeId) {
          return {};
        }

        return {
          nodes: [...state.nodes.filter((item) => item.id !== nodeId), node],
        };
      });
    },
  }));
};
