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
    const nextNode = updater(node);

    if (!(nextNode && typeof nextNode === "object")) {
      return node;
    }

    return {
      ...node,
      ...nextNode,
    };
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

const mapNodesByIds = (nodes, targetIds, updater) => {
  if (targetIds.length === 0) {
    return nodes;
  }

  const targetIdSet = new Set(targetIds);

  return nodes.map((node) => {
    if (!targetIdSet.has(node.id)) {
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

const getSelectedNodeIds = (state, nodeIds = state.selectedNodeIds) => {
  if (!(Array.isArray(nodeIds) && nodeIds.length > 0)) {
    return [];
  }

  const availableNodeIds = new Set(state.nodes.map((node) => node.id));
  const selectedNodeIds = /** @type {string[]} */ ([]);

  for (const nodeId of nodeIds) {
    if (!(nodeId && availableNodeIds.has(nodeId))) {
      continue;
    }

    if (selectedNodeIds.includes(nodeId)) {
      continue;
    }

    selectedNodeIds.push(nodeId);
  }

  return selectedNodeIds;
};

const commitEditingState = (state, selectedNodeIds = state.selectedNodeIds) => {
  if (!state.editingNodeId) {
    return {
      isHoveringSuppressed: false,
      selectedNodeIds: getSelectedNodeIds(state, selectedNodeIds),
    };
  }

  const nextText = toCommittedText(state.editingText);

  return {
    editingNodeId: null,
    editingOriginalText: "",
    editingText: nextText,
    isHoveringSuppressed: false,
    nodes: mapNodeById(state.nodes, state.editingNodeId, (node) =>
      node.text === nextText ? node : { ...node, text: nextText }
    ),
    selectedNodeIds: getSelectedNodeIds(state, selectedNodeIds),
  };
};

const finalizeEditingState = (
  state,
  selectedNodeIds = state.selectedNodeIds
) => {
  return {
    ...commitEditingState(state, selectedNodeIds),
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
    isHoveringSuppressed: isEditingNode ? false : state.isHoveringSuppressed,
    nodes: state.nodes.filter((node) => node.id !== nodeId),
    selectedNodeIds: state.selectedNodeIds.filter(
      (selectedNodeId) => selectedNodeId !== nodeId
    ),
  };
};

const deleteNodesState = (state, nodeIds) => {
  const selectedNodeIds = getSelectedNodeIds(state, nodeIds);

  if (selectedNodeIds.length === 0) {
    return {};
  }

  const selectedNodeIdSet = new Set(selectedNodeIds);
  const isEditingNodeSelected =
    state.editingNodeId && selectedNodeIdSet.has(state.editingNodeId);

  return {
    activeTool: isEditingNodeSelected ? "pointer" : state.activeTool,
    editingNodeId: isEditingNodeSelected ? null : state.editingNodeId,
    editingOriginalText: isEditingNodeSelected ? "" : state.editingOriginalText,
    editingText: isEditingNodeSelected ? "" : state.editingText,
    isHoveringSuppressed: isEditingNodeSelected
      ? false
      : state.isHoveringSuppressed,
    nodes: state.nodes.filter((node) => !selectedNodeIdSet.has(node.id)),
    selectedNodeIds: state.selectedNodeIds.filter(
      (selectedNodeId) => !selectedNodeIdSet.has(selectedNodeId)
    ),
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
      ? { ...state, ...finalizeEditingState(state, state.selectedNodeIds) }
      : state;

  return {
    activeTool: baseState.activeTool,
    editingNodeId: baseState.editingNodeId,
    editingOriginalText: baseState.editingOriginalText,
    editingText: baseState.editingText,
    nodes: mapNodeById(baseState.nodes, nodeId, {
      visible: nextVisible,
    }),
    selectedNodeIds: baseState.selectedNodeIds,
  };
};

const duplicateNodesState = (state, nodeIds) => {
  const selectedNodeIds = getSelectedNodeIds(state, nodeIds);

  if (selectedNodeIds.length === 0) {
    return {};
  }

  const committedState =
    state.editingNodeId && selectedNodeIds.includes(state.editingNodeId)
      ? { ...state, ...finalizeEditingState(state, selectedNodeIds) }
      : state;
  const selectedNodeIdSet = new Set(selectedNodeIds);
  const duplicateNodeIds = /** @type {string[]} */ ([]);
  const nodes = committedState.nodes.flatMap((node) => {
    if (!selectedNodeIdSet.has(node.id)) {
      return [node];
    }

    const duplicateNode = {
      ...node,
      id: createId(),
      x: node.x + 120,
      y: node.y + 120,
    };

    duplicateNodeIds.push(duplicateNode.id);

    return [node, duplicateNode];
  });

  return {
    activeTool: committedState.activeTool,
    editingNodeId: committedState.editingNodeId,
    editingOriginalText: committedState.editingOriginalText,
    editingText: committedState.editingText,
    nodes,
    selectedNodeIds: duplicateNodeIds,
  };
};

const moveNodesToBoundaryState = (state, nodeIds, edge) => {
  const selectedNodeIds = getSelectedNodeIds(state, nodeIds);

  if (selectedNodeIds.length === 0) {
    return {};
  }

  const selectedNodeIdSet = new Set(selectedNodeIds);
  const selectedNodes = state.nodes.filter((node) =>
    selectedNodeIdSet.has(node.id)
  );
  const unselectedNodes = state.nodes.filter(
    (node) => !selectedNodeIdSet.has(node.id)
  );

  return {
    nodes:
      edge === "back"
        ? [...selectedNodes, ...unselectedNodes]
        : [...unselectedNodes, ...selectedNodes],
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
    hoveredNodeId: null,
    isHoveringSuppressed: false,
    nodes: [],
    selectedNodeIds: [],
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
        selectedNodeIds: [node.id],
      }));
    },

    bumpFontRevision: () => {
      set((state) => ({
        fontRevision: state.fontRevision + 1,
      }));
    },

    setHoveredNodeId: (nodeId) => {
      set((state) => {
        const hoveredNodeId =
          state.isHoveringSuppressed ||
          !state.nodes.some((node) => node.id === nodeId)
            ? null
            : nodeId;

        return { hoveredNodeId };
      });
    },

    setHoveringSuppressed: (isHoveringSuppressed) => {
      set((state) => ({
        hoveredNodeId: isHoveringSuppressed ? null : state.hoveredNodeId,
        isHoveringSuppressed,
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
          isHoveringSuppressed: false,
          nodes: mapNodeById(state.nodes, state.editingNodeId, {
            text: state.editingOriginalText,
          }),
        };
      });
    },

    clearSelection: () => {
      set((state) => {
        if (state.editingNodeId) {
          return commitEditingState(state, []);
        }

        return {
          selectedNodeIds: [],
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
        if (state.selectedNodeIds.length === 0) {
          return {};
        }

        return deleteNodesState(state, state.selectedNodeIds);
      });
    },

    deleteNodeById: (nodeId) => {
      set((state) => {
        return deleteNodeState(state, nodeId);
      });
    },

    duplicateNodeById: (nodeId) => {
      set((state) => {
        return duplicateNodesState(state, [nodeId]);
      });
    },

    duplicateSelectedNodes: () => {
      set((state) => {
        return duplicateNodesState(state, state.selectedNodeIds);
      });
    },

    selectNode: (nodeId) => {
      set((state) => {
        const nextSelectedNodeIds = getSelectedNodeIds(state, [nodeId]);

        if (state.editingNodeId && state.editingNodeId !== nodeId) {
          return commitEditingState(state, nextSelectedNodeIds);
        }

        return {
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
          return finalizeEditingState(state, nextSelectedNodeIds);
        }

        return {
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
          return finalizeEditingState(state, nextSelectedNodeIds);
        }

        return {
          selectedNodeIds: nextSelectedNodeIds,
        };
      });
    },

    setActiveTool: (activeTool) => {
      set({ activeTool });
    },

    sendNodeToBack: (nodeId) => {
      set((state) => {
        return moveNodesToBoundaryState(state, [nodeId], "back");
      });
    },

    sendSelectedNodesToBack: () => {
      set((state) => {
        return moveNodesToBoundaryState(state, state.selectedNodeIds, "back");
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
            ? commitEditingState(state, [node.id])
            : {};

        return {
          ...baseState,
          activeTool: "text",
          editingNodeId: node.id,
          editingOriginalText: node.text,
          editingText: node.text,
          isHoveringSuppressed: true,
          selectedNodeIds: [node.id],
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
        if (state.selectedNodeIds.length === 0) {
          return {};
        }

        return {
          nodes: mapNodesByIds(state.nodes, state.selectedNodeIds, updater),
        };
      });
    },

    bringNodeToFront: (nodeId) => {
      set((state) => {
        return moveNodesToBoundaryState(state, [nodeId], "front");
      });
    },

    bringSelectedNodesToFront: () => {
      set((state) => {
        return moveNodesToBoundaryState(state, state.selectedNodeIds, "front");
      });
    },

    updateNodesById: (nodeIds, updater) => {
      set((state) => ({
        nodes: mapNodesByIds(
          state.nodes,
          getSelectedNodeIds(state, nodeIds),
          updater
        ),
      }));
    },
  }));
};
