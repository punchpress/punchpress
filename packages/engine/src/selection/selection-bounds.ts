import { measurePerf } from "../perf/perf-hooks";

export const getSelectionBounds = (editor, nodeIds) => {
  return measurePerf("selection.bounds", () => {
    const bounds = nodeIds
      .map((nodeId) => {
        const frame = editor.getNodeSelectionFrame(nodeId);
        if (!frame) {
          return null;
        }

        return frame.bounds;
      })
      .filter(Boolean);

    if (bounds.length === 0) {
      return null;
    }

    const minX = Math.min(...bounds.map((bbox) => bbox.minX));
    const minY = Math.min(...bounds.map((bbox) => bbox.minY));
    const maxX = Math.max(...bounds.map((bbox) => bbox.maxX));
    const maxY = Math.max(...bounds.map((bbox) => bbox.maxY));

    const selectionBounds = {
      height: maxY - minY,
      maxX,
      maxY,
      minX,
      minY,
      width: maxX - minX,
    };

    const previewDelta = editor.getSelectionPreviewDelta(nodeIds);
    if (!previewDelta) {
      return selectionBounds;
    }

    return {
      ...selectionBounds,
      maxX: selectionBounds.maxX + previewDelta.x,
      maxY: selectionBounds.maxY + previewDelta.y,
      minX: selectionBounds.minX + previewDelta.x,
      minY: selectionBounds.minY + previewDelta.y,
    };
  });
};
