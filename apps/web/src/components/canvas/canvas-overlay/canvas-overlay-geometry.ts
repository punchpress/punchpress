export const getTargetClientBounds = (targets) => {
  if (targets.length === 0) {
    return null;
  }

  const rects = targets.map((target) => target.getBoundingClientRect());
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));

  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  };
};

export const getSelectionCenter = (bounds) => {
  if (!bounds) {
    return null;
  }

  return {
    x: bounds.minX + bounds.width / 2,
    y: bounds.minY + bounds.height / 2,
  };
};

export const getHostRectFromCanvasBounds = (editor, bounds) => {
  const host = editor.hostRef;
  const viewer = editor.viewerRef;

  if (!(host && viewer && bounds && editor.zoom > 0)) {
    return null;
  }

  const scrollLeft = viewer.getScrollLeft?.();
  const scrollTop = viewer.getScrollTop?.();

  if (!(Number.isFinite(scrollLeft) && Number.isFinite(scrollTop))) {
    return null;
  }

  return {
    height: bounds.height * editor.zoom,
    left: (bounds.minX - scrollLeft) * editor.zoom,
    top: (bounds.minY - scrollTop) * editor.zoom,
    width: bounds.width * editor.zoom,
  };
};

export const getHostRectFromNodeFrame = (editor, frame) => {
  if (!frame) {
    return null;
  }

  const hostRect = getHostRectFromCanvasBounds(editor, frame.bounds);
  if (!hostRect) {
    return null;
  }

  return {
    ...hostRect,
    transform: frame.transform,
  };
};
