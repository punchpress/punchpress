import { finishEditingIfNeeded } from "../editing/editing-actions";
import { isSelected } from "../selection/selection-actions";

export const deleteSelected = (editor) => {
  finishEditingIfNeeded(editor);
  editor.run(() => {
    editor.getState().deleteSelected();
  });
};

export const deleteNode = (editor, nodeId) => {
  finishEditingIfNeeded(editor);
  if (isSelected(editor, nodeId)) {
    deleteSelected(editor);
    return;
  }

  editor.run(() => {
    editor.getState().deleteNodeById(nodeId);
  });
};

export const duplicate = (editor, nodeId) => {
  finishEditingIfNeeded(editor);
  if (!nodeId || isSelected(editor, nodeId)) {
    if (editor.selectedNodeIds.length === 0) {
      return;
    }

    editor.run(() => {
      editor.getState().duplicateSelectedNodes();
    });
    return;
  }

  editor.run(() => {
    editor.getState().duplicateNodeById(nodeId);
  });
};

export const setNodeOrder = (editor, nodeIds) => {
  finishEditingIfNeeded(editor);
  editor.run(() => {
    editor.getState().setNodeOrder(nodeIds);
  });
};

export const toggleVisibility = (editor, nodeId) => {
  finishEditingIfNeeded(editor);
  editor.run(() => {
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

    editor.run(() => {
      editor.getState().sendSelectedNodesToBack();
    });
    return;
  }

  editor.run(() => {
    editor.getState().sendNodeToBack(nodeId);
  });
};

export const updateNode = (editor, nodeId, updater) => {
  finishEditingIfNeeded(editor);
  editor.run(() => {
    editor.getState().updateNodeById(nodeId, updater);
  });
};

export const updateNodes = (editor, nodeIds, updater) => {
  finishEditingIfNeeded(editor);
  editor.run(() => {
    editor.getState().updateNodesById(nodeIds, updater);
  });
};

export const updateSelectedNode = (editor, updater) => {
  finishEditingIfNeeded(editor);
  editor.run(() => {
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

    editor.run(() => {
      editor.getState().bringSelectedNodesToFront();
    });
    return;
  }

  editor.run(() => {
    editor.getState().bringNodeToFront(nodeId);
  });
};
