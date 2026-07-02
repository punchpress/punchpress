const getViewportBounds = (editor) => {
  const host = editor.hostRef;
  const viewer = editor.viewerRef;

  if (!(host && viewer && editor.zoom > 0)) {
    return null;
  }

  const rect = host.getBoundingClientRect();
  const scrollLeft = viewer.getScrollLeft();
  const scrollTop = viewer.getScrollTop();

  return {
    minX: scrollLeft,
    minY: scrollTop,
    maxX: scrollLeft + rect.width / editor.zoom,
    maxY: scrollTop + rect.height / editor.zoom,
    width: rect.width / editor.zoom,
    height: rect.height / editor.zoom,
  };
};

export const getViewportCenter = (editor) => {
  const bounds = getViewportBounds(editor);

  if (!bounds) {
    return null;
  }

  return {
    x: bounds.minX + bounds.width / 2,
    y: bounds.minY + bounds.height / 2,
  };
};

export const getViewportWorldBounds = getViewportBounds;

export const setViewport = (editor, viewport) => {
  const previousViewport = editor.viewportState;
  const nextViewport = {
    x: viewport.x ?? previousViewport.x,
    y: viewport.y ?? previousViewport.y,
    zoom: viewport.zoom ?? previousViewport.zoom,
  };

  editor.viewportState = nextViewport;

  const storeViewport = editor.getState().viewport;

  if (
    !editor.viewportInteracting &&
    (nextViewport.x !== storeViewport.x ||
      nextViewport.y !== storeViewport.y ||
      nextViewport.zoom !== storeViewport.zoom)
  ) {
    editor.getState().setViewport(nextViewport);
  }
};
