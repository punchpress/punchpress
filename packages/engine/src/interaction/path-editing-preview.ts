import { measurePerf } from "../perf/perf-hooks";
import { PERF_SPANS } from "../perf/perf-labels";

export const getPathEditingPreview = (
  editor,
  nodeId = editor.pathEditingNodeId
) => {
  if (
    !(
      nodeId &&
      editor.pathEditingPreviewState?.nodeId === nodeId &&
      editor.pathEditingNodeId === nodeId
    )
  ) {
    return null;
  }

  return editor.pathEditingPreviewState;
};

export const getPathEditingPreviewContours = (
  editor,
  nodeId = editor.pathEditingNodeId
) => {
  return getPathEditingPreview(editor, nodeId)?.contours || null;
};

export const setPathEditingPreview = (editor, nodeId, contours, options) => {
  if (!(nodeId && contours && editor.pathEditingNodeId === nodeId)) {
    return false;
  }

  measurePerf(PERF_SPANS.pathEditPreviewSet, () => {
    editor.pathEditingPreviewState = {
      contours,
      nodeId,
      options: options || null,
    };
    editor.notifyPathEditingPreviewChanged();
  });

  return true;
};

export const clearPathEditingPreview = (
  editor,
  nodeId = editor.pathEditingNodeId
) => {
  if (
    !editor.pathEditingPreviewState ||
    (nodeId && editor.pathEditingPreviewState.nodeId !== nodeId)
  ) {
    return false;
  }

  editor.pathEditingPreviewState = null;
  editor.notifyPathEditingPreviewChanged();
  return true;
};

export const commitPathEditingPreview = (
  editor,
  nodeId = editor.pathEditingNodeId
) => {
  const preview = getPathEditingPreview(editor, nodeId);

  if (!preview) {
    return false;
  }

  const didUpdate = editor.updateEditablePath(
    preview.nodeId,
    preview.contours,
    preview.options || undefined
  );
  clearPathEditingPreview(editor, preview.nodeId);
  return didUpdate;
};

export const notifyPathEditingPreviewChanged = (editor) => {
  editor.pathEditingPreviewRevision += 1;

  for (const listener of editor.pathEditingPreviewListeners) {
    listener();
  }
};

export const subscribePathEditingPreview = (editor, listener) => {
  editor.pathEditingPreviewListeners.add(listener);

  return () => {
    editor.pathEditingPreviewListeners.delete(listener);
  };
};
