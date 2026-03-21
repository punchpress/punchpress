export const createSelectionStoreActions = (set) => {
  return {
    setActiveTool: (activeTool) => {
      set((state) => ({
        activeTool,
        pathEditingNodeId:
          activeTool === "pointer" ? state.pathEditingNodeId : null,
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

    setFocusedGroupId: (focusedGroupId) => {
      set((state) => ({
        focusedGroupId:
          focusedGroupId &&
          state.nodes.some((node) => node.id === focusedGroupId)
            ? focusedGroupId
            : null,
      }));
    },

    setPathEditingNodeId: (nodeId) => {
      set(() => ({
        pathEditingNodeId: nodeId || null,
      }));
    },

    setHoveringSuppressed: (isHoveringSuppressed) => {
      set((state) => ({
        hoveredNodeId: isHoveringSuppressed ? null : state.hoveredNodeId,
        isHoveringSuppressed,
      }));
    },

    setSpacePressed: (spacePressed) => {
      set(() => ({
        spacePressed,
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
  };
};
