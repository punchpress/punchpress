import { exitPathEditingInteractionState } from "./interaction-state";

export const createSelectionStoreActions = (set) => {
  return {
    applyInteractionState: (patch) => {
      set(() => ({
        ...patch,
      }));
    },

    setActiveTool: (activeTool) => {
      set((state) => ({
        activeTool,
        ...(activeTool === "pointer" || activeTool === "pen"
          ? {}
          : exitPathEditingInteractionState()),
        pathEditingNodeId:
          activeTool === "pointer" || activeTool === "pen"
            ? state.pathEditingNodeId
            : null,
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

    setNextShapeKind: (nextShapeKind) => {
      set(() => ({
        nextShapeKind,
      }));
    },

    setPathEditingNodeId: (nodeId) => {
      set(() => ({
        pathEditingNodeId: nodeId || null,
        pathEditingPoint: null,
      }));
    },

    setPathEditingPoint: (point) => {
      set(() => ({
        pathEditingPoint: point
          ? {
              contourIndex: point.contourIndex,
              segmentIndex: point.segmentIndex,
            }
          : null,
      }));
    },

    setHoveringSuppressed: (isHoveringSuppressed) => {
      set((state) => ({
        hoveredNodeId: isHoveringSuppressed ? null : state.hoveredNodeId,
        isHoveringSuppressed,
      }));
    },

    setSelectionDragging: (isSelectionDragging) => {
      set(() => ({
        isSelectionDragging,
      }));
    },

    setSelectionRotating: (isSelectionRotating) => {
      set(() => ({
        isSelectionRotating,
      }));
    },

    setTextPathPositioning: (isTextPathPositioning) => {
      set(() => ({
        isTextPathPositioning,
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
