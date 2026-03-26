import {
  buildNodeCapabilityGeometry,
  getNodeFrameFromGeometry,
} from "../nodes/node-capabilities";

export const PASTE_STEP = 120;

const getBoundsCenter = (bounds) => {
  return {
    x: bounds.minX + bounds.width / 2,
    y: bounds.minY + bounds.height / 2,
  };
};

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

const getNodeContentBounds = (node) => {
  if (!node || node.type === "group") {
    return null;
  }

  const geometry = buildNodeCapabilityGeometry(node, null);

  return getNodeFrameFromGeometry(node, geometry, "transform")?.bounds || null;
};

const getContentBounds = (nodes) => {
  const bounds = nodes.map(getNodeContentBounds).filter(Boolean);

  if (bounds.length === 0) {
    return null;
  }

  const minX = Math.min(...bounds.map((bbox) => bbox.minX));
  const minY = Math.min(...bounds.map((bbox) => bbox.minY));
  const maxX = Math.max(...bounds.map((bbox) => bbox.maxX));
  const maxY = Math.max(...bounds.map((bbox) => bbox.maxY));

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

const boundsOverlap = (a, b) => {
  return !(
    a.maxX < b.minX ||
    a.minX > b.maxX ||
    a.maxY < b.minY ||
    a.minY > b.maxY
  );
};

const getPasteStepCount = (editor, pasteKey) => {
  if (editor.lastPasteKey === pasteKey) {
    editor.lastPasteCount += 1;
  } else {
    editor.lastPasteKey = pasteKey;
    editor.lastPasteCount = 1;
  }

  return editor.lastPasteCount;
};

export const resetPasteSequence = (editor) => {
  editor.lastPasteCount = 0;
  editor.lastPasteKey = null;
};

export const getClipboardPasteOffset = (editor, content, pasteKey) => {
  const stepCount = getPasteStepCount(editor, pasteKey);
  const viewportBounds = getViewportBounds(editor);
  const contentBounds = getContentBounds(content?.nodes || []);
  const steppedOffset = {
    x: PASTE_STEP * stepCount,
    y: PASTE_STEP * stepCount,
  };

  if (!(viewportBounds && contentBounds)) {
    return steppedOffset;
  }

  const offsetBounds = {
    ...contentBounds,
    minX: contentBounds.minX + steppedOffset.x,
    minY: contentBounds.minY + steppedOffset.y,
    maxX: contentBounds.maxX + steppedOffset.x,
    maxY: contentBounds.maxY + steppedOffset.y,
  };

  if (boundsOverlap(offsetBounds, viewportBounds)) {
    return steppedOffset;
  }

  const viewportCenter = getBoundsCenter(viewportBounds);
  const contentCenter = getBoundsCenter(contentBounds);
  const steppedViewportOffset = PASTE_STEP * (stepCount - 1);

  return {
    x: viewportCenter.x - contentCenter.x + steppedViewportOffset,
    y: viewportCenter.y - contentCenter.y + steppedViewportOffset,
  };
};

export const getTextPastePoint = (editor, pasteKey) => {
  const stepCount = getPasteStepCount(editor, pasteKey);
  const viewportBounds = getViewportBounds(editor);

  if (!viewportBounds) {
    return null;
  }

  const viewportCenter = getBoundsCenter(viewportBounds);
  const steppedViewportOffset = PASTE_STEP * (stepCount - 1);

  return {
    x: viewportCenter.x + steppedViewportOffset,
    y: viewportCenter.y + steppedViewportOffset,
  };
};
