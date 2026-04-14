export const mountEditor = (editor) => {
  editor.preloadFonts();
  editor.initializeLocalFonts().catch((error) => {
    editor
      .getState()
      .setFontCatalogState(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to initialize local fonts."
      );
  });

  if (!editor.unsubscribe) {
    let previousNodes = editor.nodes;

    editor.unsubscribe = editor.store.subscribe((state) => {
      if (state.nodes === previousNodes) {
        return;
      }

      previousNodes = state.nodes;
      editor.preloadFonts(state.nodes);
    });
  }

  if (typeof window !== "undefined") {
    window.addEventListener("keydown", editor.handleWindowKeyDown);
    window.addEventListener(
      "keydown",
      editor.handlePenDirectSelectionModifierDown
    );
    window.addEventListener(
      "keydown",
      editor.handlePenPointTypeToggleModifierDown
    );
    window.addEventListener("keydown", editor.handleSpaceDown);
    window.addEventListener("keyup", editor.handlePenDirectSelectionModifierUp);
    window.addEventListener("keyup", editor.handlePenPointTypeToggleModifierUp);
    window.addEventListener("keyup", editor.handleSpaceUp);
    window.addEventListener("blur", editor.handleWindowBlur);
  }
};

export const disposeEditor = (editor) => {
  editor.unsubscribe?.();
  editor.unsubscribe = null;

  if (typeof window !== "undefined") {
    window.removeEventListener("keydown", editor.handleWindowKeyDown);
    window.removeEventListener(
      "keydown",
      editor.handlePenDirectSelectionModifierDown
    );
    window.removeEventListener(
      "keydown",
      editor.handlePenPointTypeToggleModifierDown
    );
    window.removeEventListener("keydown", editor.handleSpaceDown);
    window.removeEventListener(
      "keyup",
      editor.handlePenDirectSelectionModifierUp
    );
    window.removeEventListener(
      "keyup",
      editor.handlePenPointTypeToggleModifierUp
    );
    window.removeEventListener("keyup", editor.handleSpaceUp);
    window.removeEventListener("blur", editor.handleWindowBlur);
  }

  editor.cancelPendingViewportFocus();
};
