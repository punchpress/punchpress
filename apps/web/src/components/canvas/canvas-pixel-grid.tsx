import {
  getNodeCssTransform,
  getNodeScaleX,
  getNodeScaleY,
  getNodeX,
  getNodeY,
  getPixelGridTarget,
  getRasterPresentationPolicy,
} from "@punchpress/engine";
import { useId } from "react";
import { useEditorSelectionDragSurfaceValue } from "../../editor-react/use-editor-selection-drag-surface-value";
import {
  getPixelGridPreviewNode,
  getPixelGridStrokeWidths,
} from "./canvas-pixel-grid-math";

export const CanvasPixelGrid = () => {
  const id = useId().replaceAll(":", "");
  const state = useEditorSelectionDragSurfaceValue((editor, store) => {
    const policy = getRasterPresentationPolicy(store.viewport.zoom);
    const target = policy.showPixelGrid ? getPixelGridTarget(editor) : null;

    return {
      cropActive: Boolean(store.rasterCropSession),
      devicePixelRatio:
        typeof window === "undefined" ? 1 : window.devicePixelRatio,
      target: target
        ? {
            ...target,
            node: getPixelGridPreviewNode(
              target.node,
              editor.selectionDragPreview
            ),
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
    <svg
      aria-hidden="true"
      className={`canvas-pixel-grid pointer-events-none absolute overflow-hidden ${
        state.cropActive ? "z-[55]" : "z-[5]"
      }`}
      data-pixel-grid-kind={kind}
      data-pixel-grid-node-id={node.id}
      data-pixel-grid-source-node-id={sourceNodeId}
      height={node.height}
      style={{
        left: getNodeX(node),
        top: getNodeY(node),
        transform: getNodeCssTransform(node),
        transformOrigin: "center center",
      }}
      viewBox={`0 0 ${node.width} ${node.height}`}
      width={node.width}
    >
      <defs>
        <pattern height="1" id={id} patternUnits="userSpaceOnUse" width="1">
          <path
            d="M0 0V1"
            shapeRendering="crispEdges"
            stroke="currentColor"
            strokeWidth={strokeWidths.vertical}
          />
          <path
            d="M0 0H1"
            shapeRendering="crispEdges"
            stroke="currentColor"
            strokeWidth={strokeWidths.horizontal}
          />
        </pattern>
      </defs>
      <rect fill={`url(#${id})`} height="100%" width="100%" />
    </svg>
  );
};
