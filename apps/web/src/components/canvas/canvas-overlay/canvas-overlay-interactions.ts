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
        // Portaled popups (settings popovers, select lists) sit outside the
        // panels but are still app chrome, not canvas.
        "[data-slot='popover-popup']",
        "[data-slot='select-popup']",
      ].join(",")
    )
  );
};

export const shouldDeferSelectionInteraction = (editor) => {
  return editor.activeTool === "hand" || editor.getState().spacePressed;
};

export const canStartSelectionInteraction = (editor, event, isEnabled) => {
  return (
    !shouldDeferSelectionInteraction(editor) && event.button === 0 && isEnabled
  );
};
