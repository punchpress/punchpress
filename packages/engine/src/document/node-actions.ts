import { duplicateClipboardContent } from "../clipboard/clipboard-actions";
import { finishEditingIfNeeded } from "../editing/editing-actions";
import { measurePerf } from "../perf/perf-hooks";
import { PERF_SPANS } from "../perf/perf-labels";
import { isSelected } from "../selection/selection-actions";
import { getImageLocalClipBounds } from "../tools/brush-target";

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
  measurePerf(PERF_SPANS.documentGroupApply, () => {
    finishEditingIfNeeded(editor);
    if (editor.selectedNodeIds.length < 2) {
      return;
    }

    editor.run(() => {
      editor.getState().groupSelectedNodes();
    });
  });
};

export const ungroup = (editor, nodeId) => {
  measurePerf(PERF_SPANS.documentUngroupApply, () => {
    finishEditingIfNeeded(editor);
    const targetNodeId =
      nodeId && editor.isGroupNode(nodeId) ? nodeId : editor.selectedNodeId;

    if (!(targetNodeId && editor.isGroupNode(targetNodeId))) {
      return;
    }

    editor.run(() => {
      editor.getState().ungroupNodeById(targetNodeId);
    });
  });
};

export const setNodeOrder = (editor, nodeIds, parentId) => {
  measurePerf(PERF_SPANS.documentReorderApply, () => {
    finishEditingIfNeeded(editor);
    editor.run(() => {
      editor.getState().setNodeOrder(nodeIds, parentId);
    });
  });
};

export const moveNodeToParent = (editor, nodeId, parentId, beforeNodeId) => {
  measurePerf(PERF_SPANS.documentReparentApply, () => {
    finishEditingIfNeeded(editor);
    editor.run(() => {
      const node = editor.getNode(nodeId);
      const previousFrameBounds =
        node?.type === "image" ? getImageLocalClipBounds(editor, node) : null;

      editor.getState().moveNodeToParent(nodeId, parentId, beforeNodeId);

      const movedNode = editor.getNode(nodeId);
      const remainsFrameOwned =
        movedNode?.type === "image"
          ? getImageLocalClipBounds(editor, movedNode)
          : null;

      if (
        !(
          movedNode?.type === "image" &&
          previousFrameBounds &&
          !remainsFrameOwned
        )
      ) {
        return;
      }

      editor.getState().updateNodeById(nodeId, (currentNode) =>
        currentNode.type === "image"
          ? {
              ...currentNode,
              writableHeight:
                previousFrameBounds.maxY - previousFrameBounds.minY,
              writableWidth:
                previousFrameBounds.maxX - previousFrameBounds.minX,
              writableX: previousFrameBounds.minX,
              writableY: previousFrameBounds.minY,
            }
          : currentNode
      );
    });
  });
};

export const renameGroup = (editor, nodeId, name) => {
  const nextName = typeof name === "string" ? name.trim() : "";
  const node = editor.getNode(nodeId);

  if (
    !(
      (node?.type === "artboard" ||
        node?.type === "group" ||
        node?.type === "vector") &&
      nextName.length > 0
    )
  ) {
    return;
  }

  editor.run(() => {
    editor.getState().updateNodeById(nodeId, (currentNode) => {
      if (
        !(
          currentNode.type === "artboard" ||
          currentNode.type === "group" ||
          currentNode.type === "vector"
        )
      ) {
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
  measurePerf(PERF_SPANS.documentReorderApply, () => {
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

export const insertNodes = (editor, nodes) => {
  finishEditingIfNeeded(editor);
  if (!(Array.isArray(nodes) && nodes.length > 0)) {
    return;
  }

  editor.run(() => {
    editor.getState().insertNodes(nodes);
  });
};

export const addEmptyLayer = (editor) => {
  finishEditingIfNeeded(editor);
  let nodeId = null;

  editor.run(() => {
    nodeId = editor.getState().addEmptyNode();
  });

  return nodeId;
};

export const bringToFront = (editor, nodeId) => {
  measurePerf(PERF_SPANS.documentReorderApply, () => {
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
  });
};
