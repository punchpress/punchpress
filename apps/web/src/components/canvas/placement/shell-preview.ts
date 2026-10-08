import type { NodeShellState, PlacementElements } from "./shell-state";

// Per-shell previews: a moved, resized, or rotated shell box for content no
// moving layer carries. Artboard clips sit on stationary ancestors, so shells
// never rewrite clips while they move.
export const applyShellPreview = (
  { shellElement, transformElement }: PlacementElements,
  shellState: NodeShellState,
  preview
) => {
  const delta = preview.delta || { x: 0, y: 0 };
  const resizeBounds = getResizePreviewBounds(shellState, preview);
  const resizeFrame = preview.resize?.frame || null;
  const previewBounds = resizeBounds || {
    height: shellState.height,
    minX: shellState.x + (delta.x || 0),
    minY: shellState.y + (delta.y || 0),
    width: shellState.width,
  };
  const rotate = getRotatePreviewTransform(previewBounds, preview);
  const translate = `translate3d(${previewBounds.minX}px, ${previewBounds.minY}px, 0)`;

  shellElement.style.width = `${previewBounds.width}px`;
  shellElement.style.height = `${previewBounds.height}px`;
  shellElement.style.transformOrigin = rotate
    ? `${rotate.originX}px ${rotate.originY}px`
    : "";
  shellElement.style.transform = rotate
    ? `${translate} rotate(${rotate.rotation}deg)`
    : translate;
  transformElement.style.transform =
    resizeFrame?.transform || shellState.transform || "";
  transformElement.style.transformOrigin = resizeFrame
    ? "center center"
    : shellState.transformOrigin;
};

export const getShellPreviewKey = (preview) => {
  if (preview.resize) {
    const { anchorCanvas, frame, scale } = preview.resize;

    return frame
      ? `resize-frame:${frame.bounds?.minX}:${frame.bounds?.minY}:${frame.bounds?.width}:${frame.bounds?.height}:${frame.transform || ""}`
      : `resize:${anchorCanvas?.x}:${anchorCanvas?.y}:${scale}`;
  }

  if (preview.rotate) {
    const { centerCanvas, deltaRotation } = preview.rotate;

    return `rotate:${centerCanvas?.x}:${centerCanvas?.y}:${deltaRotation}`;
  }

  return `move:${preview.delta?.x}:${preview.delta?.y}`;
};

const getResizePreviewBounds = (shellState: NodeShellState, preview) => {
  const resize = preview.resize;

  if (!resize) {
    return null;
  }

  if (resize.frame?.bounds) {
    return resize.frame.bounds;
  }

  const scale = Number.isFinite(resize.scale) ? resize.scale : 1;
  const anchor = resize.anchorCanvas;

  if (!anchor) {
    return null;
  }

  return {
    height: Math.max(1, shellState.height * scale),
    minX: anchor.x + (shellState.x - anchor.x) * scale,
    minY: anchor.y + (shellState.y - anchor.y) * scale,
    width: Math.max(1, shellState.width * scale),
  };
};

const getRotatePreviewTransform = (previewBounds, preview) => {
  const rotate = preview.rotate;

  if (!rotate?.centerCanvas) {
    return null;
  }

  return {
    originX: rotate.centerCanvas.x - previewBounds.minX,
    originY: rotate.centerCanvas.y - previewBounds.minY,
    rotation: Number.isFinite(rotate.deltaRotation) ? rotate.deltaRotation : 0,
  };
};
