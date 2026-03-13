export const queueMoveableRefresh = (moveableRef) => {
  if (typeof window === "undefined") {
    moveableRef.current?.updateRect?.();
    return;
  }

  window.requestAnimationFrame(() => {
    moveableRef.current?.updateRect?.();
  });
};

export const setMoveableMuted = (hostElement, muted) => {
  hostElement?.classList.toggle("canvas-overlay-moveable-muted", muted);
};

export const setGroupRotationPreviewActive = (hostElement, active) => {
  hostElement?.classList.toggle("canvas-overlay-group-rotating", active);
};

export const shouldBlockSelectionStart = (target) => {
  if (!(target instanceof Element)) {
    return false;
  }

  if (target.closest(".canvas-node")) {
    return false;
  }

  return Boolean(
    target.closest(
      [
        "button",
        "input",
        "select",
        "textarea",
        "[contenteditable='true']",
        "[role='button']",
        "[role='menu']",
        "[role='menuitem']",
      ].join(",")
    )
  );
};

export const getTransformFlags = ({
  activeTool,
  editingNodeId,
  hasGroupSelection,
  selectedBounds,
  selectedGeometry,
  selectedNode,
  selectedTarget,
  selectedTargets,
}) => {
  return {
    isDraggable: Boolean(
      activeTool === "pointer" && selectedTargets.length > 0 && !editingNodeId
    ),
    isResizable: Boolean(
      activeTool === "pointer" &&
        selectedTargets.length > 0 &&
        (hasGroupSelection ? selectedBounds : selectedTarget) &&
        (hasGroupSelection || (selectedNode && selectedGeometry)) &&
        !editingNodeId
    ),
    isRotatable: Boolean(
      activeTool === "pointer" &&
        selectedTargets.length > 0 &&
        (hasGroupSelection ? selectedBounds : selectedGeometry) &&
        !editingNodeId
    ),
  };
};
