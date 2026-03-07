import create from "zustand";
import { FALLBACK_FONTS } from "../constants";
import { createDefaultNode } from "../model";

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
    nodes: state.nodes.map((node) => {
      if (node.id !== state.editingNodeId) {
        return node;
      }

      if (node.text === nextText) {
        return node;
      }

      return {
        ...node,
        text: nextText,
      };
    }),
    selectedNodeId,
  };
};

const resolveDefaultFontUrl = (fonts) => {
  return fonts[0]?.url || FALLBACK_FONTS[0].url;
};

export const useEditorStore = create((set) => ({
  activeTool: "pointer",
  editingNodeId: null,
  editingOriginalText: "",
  editingText: "",
  fontRevision: 0,
  nodes: [],
  selectedNodeId: null,

  addTextNode: (fonts, point) => {
    const node = createDefaultNode(resolveDefaultFontUrl(fonts));

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

  cancelEditing: () => {
    set((state) => {
      if (!state.editingNodeId) {
        return {};
      }

      return {
        editingNodeId: null,
        editingOriginalText: "",
        editingText: state.editingOriginalText,
        nodes: state.nodes.map((node) => {
          if (node.id !== state.editingNodeId) {
            return node;
          }

          return {
            ...node,
            text: state.editingOriginalText,
          };
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
          state.editingNodeId === state.selectedNodeId ? "" : state.editingText,
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
        nodes: state.nodes.map((node) => {
          if (node.id !== state.editingNodeId) {
            return node;
          }

          return {
            ...node,
            text: value.length > 0 ? value : " ",
          };
        }),
      };
    });
  },

  setFontRevision: (fontRevision) => {
    set({ fontRevision });
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
      nodes: state.nodes.map((node) => {
        if (node.id !== nodeId) {
          return node;
        }

        return applyNodeUpdate(node, updater);
      }),
    }));
  },

  updateSelectedNode: (updater) => {
    set((state) => {
      if (!state.selectedNodeId) {
        return {};
      }

      return {
        nodes: state.nodes.map((node) => {
          if (node.id !== state.selectedNodeId) {
            return node;
          }

          return applyNodeUpdate(node, updater);
        }),
      };
    });
  },
}));
