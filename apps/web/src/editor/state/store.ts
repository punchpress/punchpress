import createStore from "zustand/vanilla";
import { FALLBACK_FONTS } from "../constants";
import { createDefaultNode } from "../shapes/warp-text/model";

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

        return {
          editingNodeId:
            state.editingNodeId === state.selectedNodeId
              ? null
              : state.editingNodeId,
          editingOriginalText:
            state.editingNodeId === state.selectedNodeId
              ? ""
              : state.editingOriginalText,
          editingText:
            state.editingNodeId === state.selectedNodeId
              ? ""
              : state.editingText,
          nodes: state.nodes.filter((node) => node.id !== state.selectedNodeId),
          selectedNodeId: null,
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
  }));
};
