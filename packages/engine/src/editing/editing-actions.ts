export const addShapeNode = (editor, point, shape) => {
  finishEditingIfNeeded(editor);
  editor.run(() => {
    editor.getState().addShapeNode(point, shape || editor.nextShapeKind);
  });
};

export const addTextNode = (editor, point) => {
  finishEditingIfNeeded(editor);
  editor.editingHistoryMark = editor.markHistoryStep("add text");
  editor.getState().addTextNode(point, editor.getDefaultFont());
};

export const cancelEditing = (editor) => {
  editor.getState().cancelEditing();
  commitEditingHistoryStep(editor);
  editor.getState().setActiveTool("pointer");
};

export const commitEditing = (editor) => {
  editor.getState().commitEditing();
};

export const finalizeEditing = (editor) => {
  commitEditing(editor);
  commitEditingHistoryStep(editor);
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

  if (!editor.editingHistoryMark) {
    editor.editingHistoryMark = editor.markHistoryStep("edit text");
  }

  editor.getState().startEditing(node);
};

export const finishEditingIfNeeded = (editor) => {
  if (!editor.editingNodeId) {
    return;
  }

  finalizeEditing(editor);
};

const commitEditingHistoryStep = (editor) => {
  if (!editor.editingHistoryMark) {
    return;
  }

  editor.commitHistoryStep(editor.editingHistoryMark);
  editor.editingHistoryMark = null;
};
