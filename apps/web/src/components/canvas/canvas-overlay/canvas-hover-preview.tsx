import { useEditorSurfaceValue } from "../../../editor-react/use-editor-surface-value";
import { CanvasPathPreviewSvg } from "./canvas-path-preview-svg";

const HOVER_OUTSET_PX = 1;

const PathHoverPreview = ({ bbox, bounds, paths, transform }) => {
  return (
    <div
      className="canvas-hover-preview pointer-events-none absolute"
      data-preview-kind="path"
      style={{
        height: `${Math.max(1, bounds.height)}px`,
        transform: transform
          ? `translate3d(${bounds.minX}px, ${bounds.minY}px, 0) ${transform}`
          : `translate3d(${bounds.minX}px, ${bounds.minY}px, 0)`,
        transformOrigin: "center center",
        width: `${Math.max(1, bounds.width)}px`,
      }}
    >
      <CanvasPathPreviewSvg bbox={bbox} paths={paths} />
    </div>
  );
};

const BoundsHoverPreview = ({ bounds, transform }) => {
  return (
    <div
      className="canvas-hover-preview pointer-events-none absolute"
      data-preview-kind="bounds"
      style={{
        height: `${bounds.height + HOVER_OUTSET_PX * 2}px`,
        transform: transform
          ? `translate3d(${bounds.minX - HOVER_OUTSET_PX}px, ${bounds.minY - HOVER_OUTSET_PX}px, 0) ${transform}`
          : `translate3d(${bounds.minX - HOVER_OUTSET_PX}px, ${bounds.minY - HOVER_OUTSET_PX}px, 0)`,
        transformOrigin: "center center",
        width: `${bounds.width + HOVER_OUTSET_PX * 2}px`,
      }}
    />
  );
};

export const CanvasHoverPreview = () => {
  const hoveredNodePreview = useEditorSurfaceValue((editor) => {
    return editor.getHoveredNodePreview();
  });

  if (!hoveredNodePreview) {
    return null;
  }

  if (hoveredNodePreview.kind === "path") {
    return <PathHoverPreview {...hoveredNodePreview} />;
  }

  return <BoundsHoverPreview {...hoveredNodePreview} />;
};
