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
import { useEditorViewportValue } from "../../editor-react/use-editor-viewport-value";
import { CanvasPixelGridLines } from "./canvas-pixel-grid-lines";
import {
  getPixelGridPreviewNode,
  getPixelGridStrokeWidths,
} from "./canvas-pixel-grid-math";

export const CanvasPixelGrid = () => {
  const state = useEditorSelectionDragSurfaceValue((editor, store) => {
    const target = getPixelGridTarget(editor);
    const frameTarget = target?.kind === "frame" ? target : null;
    const node = frameTarget
      ? getPixelGridPreviewNode(frameTarget.node, editor.selectionDragPreview)
      : null;

    return {
      cropActive: Boolean(store.rasterCropSession),
      devicePixelRatio:
        typeof window === "undefined" ? 1 : window.devicePixelRatio,
      target: frameTarget && node ? { ...frameTarget, node } : null,
    };
  });
  const targetNode = state.target?.node;
  // The grid appears and disappears as the live camera crosses the pixel
  // footprint threshold, mid-gesture included.
  const showPixelGrid = useEditorViewportValue((editor) =>
    Boolean(
      targetNode &&
        shouldShowPixelGrid(
          getRasterPixelFootprint({
            displayedHeight: 1,
            displayedWidth: 1,
            sampleHeight: 1,
            sampleWidth: 1,
            scaleX: getNodeScaleX(targetNode) ?? 1,
            scaleY: getNodeScaleY(targetNode) ?? 1,
            zoom: editor.zoom,
          })
        )
    )
  );

  if (!(state.target && showPixelGrid)) {
    return null;
  }

  const { kind, node, sourceNodeId } = state.target;
  const strokeWidths = getPixelGridStrokeWidths({
    devicePixelRatio: state.devicePixelRatio,
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
          <CanvasPixelGridLines
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
