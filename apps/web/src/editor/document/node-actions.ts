import { finishEditingIfNeeded } from "../editing/editing-actions";
import { isSelected } from "../selection/selection-actions";

export const deleteSelected = (editor) => {
  finishEditingIfNeeded(editor);
  editor.runDocumentChange(() => {
    editor.getState().deleteSelected();
  });
};

export const deleteNode = (editor, nodeId) => {
  finishEditingIfNeeded(editor);
  if (isSelected(editor, nodeId)) {
    deleteSelected(editor);
    return;
  }

  editor.runDocumentChange(() => {
    editor.getState().deleteNodeById(nodeId);
  });
};

export const duplicateNode = (editor, nodeId) => {
  finishEditingIfNeeded(editor);
  if (isSelected(editor, nodeId)) {
    duplicateSelected(editor);
    return;
  }

  editor.runDocumentChange(() => {
    editor.getState().duplicateNodeById(nodeId);
  });
};

export const duplicateSelected = (editor) => {
  finishEditingIfNeeded(editor);
  editor.runDocumentChange(() => {
    editor.getState().duplicateSelectedNodes();
  });
};

export const setNodeOrder = (editor, nodeIds) => {
  finishEditingIfNeeded(editor);
  editor.runDocumentChange(() => {
    editor.getState().setNodeOrder(nodeIds);
  });
};

export const toggleNodeVisibility = (editor, nodeId) => {
  finishEditingIfNeeded(editor);
  editor.runDocumentChange(() => {
    editor.getState().toggleNodeVisibilityById(nodeId);
  });
};

export const sendNodeToBack = (editor, nodeId) => {
  finishEditingIfNeeded(editor);
  if (isSelected(editor, nodeId) && editor.selectedNodeIds.length > 1) {
    sendSelectedToBack(editor);
    return;
  }

  editor.runDocumentChange(() => {
    editor.getState().sendNodeToBack(nodeId);
  });
};

export const sendSelectedToBack = (editor) => {
  finishEditingIfNeeded(editor);
  editor.runDocumentChange(() => {
    editor.getState().sendSelectedNodesToBack();
  });
};

export const updateNode = (editor, nodeId, updater) => {
  finishEditingIfNeeded(editor);
  editor.runDocumentChange(() => {
    editor.getState().updateNodeById(nodeId, updater);
  });
};

export const updateNodes = (editor, nodeIds, updater) => {
  finishEditingIfNeeded(editor);
  editor.runDocumentChange(() => {
    editor.getState().updateNodesById(nodeIds, updater);
  });
};

export const updateSelectedNode = (editor, updater) => {
  finishEditingIfNeeded(editor);
  editor.runDocumentChange(() => {
    editor.getState().updateSelectedNode(updater);
  });
};

export const bringNodeToFront = (editor, nodeId) => {
  finishEditingIfNeeded(editor);
  if (isSelected(editor, nodeId) && editor.selectedNodeIds.length > 1) {
    bringSelectedToFront(editor);
    return;
  }

  editor.runDocumentChange(() => {
    editor.getState().bringNodeToFront(nodeId);
  });
};

export const bringSelectedToFront = (editor) => {
  finishEditingIfNeeded(editor);
  editor.runDocumentChange(() => {
    editor.getState().bringSelectedNodesToFront();
  });
};
