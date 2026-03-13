export const addTextNode = (editor, point) => {
  finishEditingIfNeeded(editor);
  editor.beginHistoryTransaction();
  editor.getState().addTextNode(point, editor.getDefaultFont());
};

export const cancelEditing = (editor) => {
  editor.getState().cancelEditing();
  editor.endHistoryTransaction();
  editor.getState().setActiveTool("pointer");
};

export const commitEditing = (editor) => {
  editor.getState().commitEditing();
};

export const finalizeEditing = (editor) => {
  commitEditing(editor);
  editor.endHistoryTransaction();
  editor.getState().setActiveTool("pointer");
};

export const setActiveTool = (editor, toolId) => {
  if (!editor.tools.has(toolId)) {
    return;
  }

  if (toolId !== "text" && editor.editingNodeId) {
    finalizeEditing(editor);
  }

  editor.getState().setActiveTool(toolId);
};

export const setEditingText = (editor, value) => {
  editor.getState().setEditingText(value);
};

export const startEditing = (editor, node) => {
  if (editor.editingNodeId && editor.editingNodeId !== node.id) {
    finalizeEditing(editor);
  }

  editor.beginHistoryTransaction();
  editor.getState().startEditing(node);
};

export const finishEditingIfNeeded = (editor) => {
  if (!editor.editingNodeId) {
    return;
  }

  finalizeEditing(editor);
};
