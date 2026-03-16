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

export const duplicate = (editor, nodeId) => {
  finishEditingIfNeeded(editor);
  if (!nodeId || isSelected(editor, nodeId)) {
    if (editor.selectedNodeIds.length === 0) {
      return;
    }

    editor.runDocumentChange(() => {
      editor.getState().duplicateSelectedNodes();
    });
    return;
  }

  editor.runDocumentChange(() => {
    editor.getState().duplicateNodeById(nodeId);
  });
};

export const setNodeOrder = (editor, nodeIds) => {
  finishEditingIfNeeded(editor);
  editor.runDocumentChange(() => {
    editor.getState().setNodeOrder(nodeIds);
  });
};

export const toggleVisibility = (editor, nodeId) => {
  finishEditingIfNeeded(editor);
  editor.runDocumentChange(() => {
    editor.getState().toggleNodeVisibilityById(nodeId);
  });
};

export const sendToBack = (editor, nodeId) => {
  finishEditingIfNeeded(editor);
  if (
    !nodeId ||
    (isSelected(editor, nodeId) && editor.selectedNodeIds.length > 1)
  ) {
    if (editor.selectedNodeIds.length === 0) {
      return;
    }

    editor.runDocumentChange(() => {
      editor.getState().sendSelectedNodesToBack();
    });
    return;
  }

  editor.runDocumentChange(() => {
    editor.getState().sendNodeToBack(nodeId);
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

export const bringToFront = (editor, nodeId) => {
  finishEditingIfNeeded(editor);
  if (
    !nodeId ||
    (isSelected(editor, nodeId) && editor.selectedNodeIds.length > 1)
  ) {
    if (editor.selectedNodeIds.length === 0) {
      return;
    }

    editor.runDocumentChange(() => {
      editor.getState().bringSelectedNodesToFront();
    });
    return;
  }

  editor.runDocumentChange(() => {
    editor.getState().bringNodeToFront(nodeId);
  });
};
