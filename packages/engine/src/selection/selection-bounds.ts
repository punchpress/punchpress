import { incrementPerfCounter, measurePerf } from "../perf/perf-hooks";

export const getSelectionBounds = (editor, nodeIds) => {
  return measurePerf("selection.bounds", () => {
    const bounds = nodeIds
      .map((nodeId) => {
        const renderedBounds = getRenderedNodeBounds(editor, nodeId);
        if (renderedBounds) {
          return renderedBounds;
        }

        const frame = editor.getNodeFrame(nodeId);
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

    return {
      height: maxY - minY,
      maxX,
      maxY,
      minX,
      minY,
      width: maxX - minX,
    };
  });
};

const getRenderedNodeBounds = (editor, nodeId) => {
  const element =
    editor.getNodeTransformElement(nodeId) || editor.getNodeElement(nodeId);
  const host = editor.hostRef;
  const viewer = editor.viewerRef;

  if (!(element && host && viewer && editor.zoom > 0)) {
    return null;
  }

  incrementPerfCounter("dom.rect.reads", 2);
  const elementRect = element.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  const scrollLeft = viewer.getScrollLeft?.();
  const scrollTop = viewer.getScrollTop?.();

  if (!(Number.isFinite(scrollLeft) && Number.isFinite(scrollTop))) {
    return null;
  }

  return {
    maxX: scrollLeft + (elementRect.right - hostRect.left) / editor.zoom,
    maxY: scrollTop + (elementRect.bottom - hostRect.top) / editor.zoom,
    minX: scrollLeft + (elementRect.left - hostRect.left) / editor.zoom,
    minY: scrollTop + (elementRect.top - hostRect.top) / editor.zoom,
  };
};
