import { estimateBounds } from "../shapes/warp-text/warp-layout";

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

const getContentBounds = (nodes) => {
  const textNodes = nodes.filter((node) => node?.type === "text");

  if (textNodes.length === 0) {
    return null;
  }

  const firstNode = textNodes[0];
  const firstEstimate = estimateBounds(firstNode);
  let bounds = {
    minX: firstNode.transform.x + firstEstimate.minX,
    minY: firstNode.transform.y + firstEstimate.minY,
    maxX: firstNode.transform.x + firstEstimate.maxX,
    maxY: firstNode.transform.y + firstEstimate.maxY,
    width: firstEstimate.width,
    height: firstEstimate.height,
  };

  for (const node of textNodes.slice(1)) {
    const estimate = estimateBounds(node);
    const nodeBounds = {
      minX: node.transform.x + estimate.minX,
      minY: node.transform.y + estimate.minY,
      maxX: node.transform.x + estimate.maxX,
      maxY: node.transform.y + estimate.maxY,
      width: estimate.width,
      height: estimate.height,
    };

    if (!bounds) {
      bounds = nodeBounds;
      continue;
    }

    const minX = Math.min(bounds.minX, nodeBounds.minX);
    const minY = Math.min(bounds.minY, nodeBounds.minY);
    const maxX = Math.max(bounds.maxX, nodeBounds.maxX);
    const maxY = Math.max(bounds.maxY, nodeBounds.maxY);
    bounds = {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  return bounds;
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
