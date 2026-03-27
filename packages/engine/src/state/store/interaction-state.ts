export const resetTransientCanvasInteractionState = () => {
  return {
    hoveredNodeId: null,
    isHoveringSuppressed: false,
    isSelectionDragging: false,
    isSelectionRotating: false,
    isTextPathPositioning: false,
  };
};

export const enterTextEditingInteractionState = () => {
  return {
    ...resetTransientCanvasInteractionState(),
    isHoveringSuppressed: true,
    pathEditingNodeId: null,
    pathEditingPoint: null,
  };
};

export const enterPathEditingInteractionState = (nodeId) => {
  return {
    ...resetTransientCanvasInteractionState(),
    pathEditingNodeId: nodeId || null,
    pathEditingPoint: null,
  };
};

export const exitPathEditingInteractionState = () => {
  return {
    ...resetTransientCanvasInteractionState(),
    pathEditingNodeId: null,
    pathEditingPoint: null,
  };
};

export const beginSelectionDragInteractionState = () => {
  return {
    ...resetTransientCanvasInteractionState(),
    isHoveringSuppressed: true,
    isSelectionDragging: true,
  };
};

export const endSelectionDragInteractionState = () => {
  return resetTransientCanvasInteractionState();
};

export const beginSelectionRotationInteractionState = () => {
  return {
    ...resetTransientCanvasInteractionState(),
    isHoveringSuppressed: true,
    isSelectionRotating: true,
  };
};

export const endSelectionRotationInteractionState = () => {
  return resetTransientCanvasInteractionState();
};

export const beginTextPathPositioningInteractionState = () => {
  return {
    ...resetTransientCanvasInteractionState(),
    isHoveringSuppressed: true,
    isTextPathPositioning: true,
  };
};

export const endTextPathPositioningInteractionState = () => {
  return resetTransientCanvasInteractionState();
};
