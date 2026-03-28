import { duplicateClipboardContent } from "../clipboard/clipboard-actions";
import { insertVectorPoint as insertVectorPointOnContours } from "../nodes/vector/point-insert";
import { setVectorPointType as setVectorPointTypeOnContours } from "../nodes/vector/point-edit";
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

    duplicateClipboardContent(editor, editor.selectedNodeIds);
    return;
  }

  duplicateClipboardContent(editor, [nodeId]);
};

export const duplicateForDrag = (editor, nodeId) => {
  finishEditingIfNeeded(editor);
  if (!nodeId || isSelected(editor, nodeId)) {
    if (editor.selectedNodeIds.length === 0) {
      return;
    }

    duplicateClipboardContent(editor, editor.selectedNodeIds, {
      offset: { x: 0, y: 0 },
    });
    return;
  }

  duplicateClipboardContent(editor, [nodeId], {
    offset: { x: 0, y: 0 },
  });
};

export const groupSelected = (editor) => {
  finishEditingIfNeeded(editor);
  if (editor.selectedNodeIds.length < 2) {
    return;
  }

  editor.run(() => {
    editor.getState().groupSelectedNodes();
  });
};

export const ungroup = (editor, nodeId) => {
  finishEditingIfNeeded(editor);
  const targetNodeId =
    nodeId && editor.isGroupNode(nodeId) ? nodeId : editor.selectedNodeId;

  if (!(targetNodeId && editor.isGroupNode(targetNodeId))) {
    return;
  }

  editor.run(() => {
    editor.getState().ungroupNodeById(targetNodeId);
  });
};

export const setNodeOrder = (editor, nodeIds, parentId) => {
  finishEditingIfNeeded(editor);
  editor.run(() => {
    editor.getState().setNodeOrder(nodeIds, parentId);
  });
};

export const renameGroup = (editor, nodeId, name) => {
  const nextName = typeof name === "string" ? name.trim() : "";
  const node = editor.getNode(nodeId);

  if (!(node?.type === "group" && nextName.length > 0)) {
    return;
  }

  editor.run(() => {
    editor.getState().updateNodeById(nodeId, (currentNode) => {
      if (currentNode.type !== "group") {
        return currentNode;
      }

      return {
        ...currentNode,
        name: nextName,
      };
    });
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

export const setVectorPointType = (
  editor,
  nodeId,
  point,
  pointType
) => {
  const node = editor.getNode(nodeId);

  if (!(node?.type === "vector" && point)) {
    return false;
  }

  editor.run(() => {
    editor.getState().updateNodeById(nodeId, (currentNode) => {
      if (currentNode.type !== "vector") {
        return currentNode;
      }

      return {
        ...currentNode,
        contours: setVectorPointTypeOnContours(currentNode.contours, {
          contourIndex: point.contourIndex,
          pointType,
          segmentIndex: point.segmentIndex,
        }),
      };
    });
  });

  return true;
};

export const insertVectorPoint = (
  editor,
  nodeId,
  target
) => {
  const node = editor.getNode(nodeId);

  if (!(node?.type === "vector" && target)) {
    return false;
  }

  editor.run(() => {
    editor.getState().updateNodeById(nodeId, (currentNode) => {
      if (currentNode.type !== "vector") {
        return currentNode;
      }

      return {
        ...currentNode,
        contours: insertVectorPointOnContours(currentNode.contours, target),
      };
    });
    editor.getState().setPathEditingPoint({
      contourIndex: target.contourIndex,
      segmentIndex: target.segmentIndex,
    });
  });

  return true;
};
