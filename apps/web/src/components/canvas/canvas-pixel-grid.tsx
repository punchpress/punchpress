import {
  getNodeCssTransform,
  getNodeScaleX,
  getNodeScaleY,
  getNodeX,
  getNodeY,
  getPixelGridTarget,
  getRasterPixelFootprint,
  shouldShowPixelGrid,
} from "@punchpress/engine";
import { useEditorSelectionDragSurfaceValue } from "../../editor-react/use-editor-selection-drag-surface-value";
import {
  getPixelGridPreviewNode,
  getPixelGridStrokeWidths,
} from "./canvas-pixel-grid-math";
import { CanvasPixelGridPattern } from "./canvas-pixel-grid-pattern";

export const CanvasPixelGrid = () => {
  const state = useEditorSelectionDragSurfaceValue((editor, store) => {
    const target = getPixelGridTarget(editor);
    const frameTarget = target?.kind === "frame" ? target : null;
    const node = frameTarget
      ? getPixelGridPreviewNode(frameTarget.node, editor.selectionDragPreview)
      : null;
    const showPixelGrid =
      node &&
      shouldShowPixelGrid(
        getRasterPixelFootprint({
          displayedHeight: 1,
          displayedWidth: 1,
          sampleHeight: 1,
          sampleWidth: 1,
          scaleX: getNodeScaleX(node) ?? 1,
          scaleY: getNodeScaleY(node) ?? 1,
          zoom: store.viewport.zoom,
        })
      );

    return {
      cropActive: Boolean(store.rasterCropSession),
      devicePixelRatio:
        typeof window === "undefined" ? 1 : window.devicePixelRatio,
      target:
        frameTarget && node && showPixelGrid
          ? {
              ...frameTarget,
              node,
            }
          : null,
      zoom: store.viewport.zoom,
    };
  });

  if (!state.target) {
    return null;
  }

  const { kind, node, sourceNodeId } = state.target;
  const scaleX = getNodeScaleX(node) ?? 1;
  const scaleY = getNodeScaleY(node) ?? 1;
  const strokeWidths = getPixelGridStrokeWidths({
    devicePixelRatio: state.devicePixelRatio,
    scaleX,
    scaleY,
    zoom: state.zoom,
  });

  return (
    <div
      aria-hidden="true"
      className={`canvas-pixel-grid pointer-events-none absolute ${
        state.cropActive ? "z-[55]" : "z-[5]"
      }`}
      style={{
        height: node.height,
        left: getNodeX(node),
        top: getNodeY(node),
        width: node.width,
      }}
    >
      <div
        className="absolute h-full w-full"
        style={{
          transform: getNodeCssTransform(node),
          transformOrigin: "center center",
        }}
      >
        <svg
          aria-hidden="true"
          className="block h-full w-full overflow-hidden"
          height={node.height}
          viewBox={`0 0 ${node.width} ${node.height}`}
          width={node.width}
        >
          <CanvasPixelGridPattern
            bounds={{ height: node.height, width: node.width, x: 0, y: 0 }}
            kind={kind}
            nodeId={node.id}
            plane={{ cellHeight: 1, cellWidth: 1, originX: 0, originY: 0 }}
            sourceNodeId={sourceNodeId}
            strokeWidths={strokeWidths}
          />
        </svg>
      </div>
    </div>
  );
};
