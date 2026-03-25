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
  isPathEditingSelection,
  isTextPathPositioning,
  selectedBounds,
  selectedEditCapabilities,
  selectedNode,
}) => {
  if (isPathEditingSelection) {
    return {
      isDraggable: false,
      isResizable: Boolean(
        activeTool === "pointer" &&
          selectedNode &&
          selectedEditCapabilities &&
          !editingNodeId &&
          !isTextPathPositioning
      ),
      isRotatable: false,
    };
  }

  return {
    isDraggable: Boolean(
      activeTool === "pointer" &&
        Boolean(selectedNode || hasGroupSelection) &&
        !editingNodeId
    ),
    isResizable: Boolean(
      activeTool === "pointer" &&
        (hasGroupSelection ? selectedBounds : selectedNode) &&
        (hasGroupSelection || (selectedNode && selectedEditCapabilities)) &&
        !editingNodeId
    ),
    isRotatable: Boolean(
      activeTool === "pointer" &&
        (hasGroupSelection ? selectedBounds : selectedEditCapabilities) &&
        !editingNodeId
    ),
  };
};
