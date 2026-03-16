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
    editor.unsubscribeEditorCommand =
      window.electron?.editorCommands?.onCommand((command) => {
        if (command === "undo") {
          editor.undo();
          return;
        }

        editor.redo();
      }) || null;
    window.addEventListener("keydown", editor.handleWindowKeyDown);
    window.addEventListener("keydown", editor.handleSpaceDown);
    window.addEventListener("keyup", editor.handleSpaceUp);
  }
};

export const disposeEditor = (editor) => {
  editor.unsubscribeEditorCommand?.();
  editor.unsubscribeEditorCommand = null;
  editor.unsubscribe?.();
  editor.unsubscribe = null;

  if (typeof window !== "undefined") {
    window.removeEventListener("keydown", editor.handleWindowKeyDown);
    window.removeEventListener("keydown", editor.handleSpaceDown);
    window.removeEventListener("keyup", editor.handleSpaceUp);
  }

  editor.cancelPendingViewportFocus();
};
