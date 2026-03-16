const queueOverlayRefresh = (editor) => {
  if (typeof window === "undefined") {
    editor.onViewportChange?.();
    return;
  }

  window.requestAnimationFrame(() => {
    editor.onViewportChange?.();
  });
};

export const createEditorE2eApi = (editor) => {
  return {
    createTextNode: ({ text = "YOUR TEXT", x = 600, y = 450 } = {}) => {
      editor.addTextNode({ x, y });
      editor.setEditingText(text);
      editor.finalizeEditing();
      return editor.selectedNodeId;
    },
    exportDocument: () => {
      return editor.exportDocument();
    },
    requestLocalFonts: () => {
      return editor.requestLocalFonts();
    },
    panViewportBy: ({ x = 0, y = 0 } = {}) => {
      const viewer = editor.viewerRef;

      if (!viewer) {
        return false;
      }

      viewer.scrollBy(x, y);
      queueOverlayRefresh(editor);

      return true;
    },
    getDebugDump: () => {
      return editor.getDebugDump();
    },
    loadDocument: (contents) => {
      editor.loadDocument(contents);
      return editor.selectedNodeId;
    },
    serializeDocument: () => {
      return editor.serializeDocument();
    },
    setSelectedText: (text) => {
      const selectedNodeId = editor.setSelectedText(text);
      queueOverlayRefresh(editor);
      return selectedNodeId;
    },
    setSelectedFont: (font) => {
      const selectedNodeId = editor.setSelectedFont(font);
      queueOverlayRefresh(editor);
      return selectedNodeId;
    },
  };
};
