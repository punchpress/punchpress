import {
  getNodeCssTransform,
  getNodeScaleX,
  getNodeScaleY,
  getNodeX,
  getNodeY,
  getPixelGridTarget,
  getRasterPresentationPolicy,
} from "@punchpress/engine";
import { useCallback, useId, useSyncExternalStore } from "react";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorSelectionDragSurfaceValue } from "../../editor-react/use-editor-selection-drag-surface-value";
import {
  getPixelGridPlane,
  getPixelGridPreviewNode,
  getPixelGridStrokeWidths,
} from "./canvas-pixel-grid-math";

export const CanvasPixelGrid = () => {
  const id = useId().replaceAll(":", "");
  const editor = useEditor();
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
  const sampleSize = useRasterSampleSize(
    editor,
    state.target?.kind === "raster" ? state.target.sourceNodeId : null,
    state.target?.node
  );

  if (!state.target) {
    return null;
  }

  const { kind, node, sourceNodeId } = state.target;
  const plane =
    kind === "raster"
      ? getPixelGridPlane(node, sampleSize)
      : {
          cellHeight: 1,
          cellWidth: 1,
          originX: 0,
          originY: 0,
        };
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
        ...(kind === "raster"
          ? {
              transform: `translate3d(${getNodeX(node)}px, ${getNodeY(node)}px, 0)`,
            }
          : {
              left: getNodeX(node),
              top: getNodeY(node),
            }),
        width: node.width,
      }}
    >
      <div
        className="absolute h-full w-full"
        data-pixel-grid-kind={kind}
        data-pixel-grid-node-id={node.id}
        data-pixel-grid-source-node-id={sourceNodeId}
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
          <defs>
            <pattern
              data-testid="pixel-grid-pattern"
              height={plane.cellHeight}
              id={id}
              patternUnits="userSpaceOnUse"
              width={plane.cellWidth}
              x={plane.originX}
              y={plane.originY}
            >
              <path
                d={`M0 0V${plane.cellHeight}`}
                data-pixel-grid-tone="dark"
                stroke="#000"
                strokeOpacity="0.52"
                strokeWidth={strokeWidths.vertical * 2}
              />
              <path
                d={`M0 0H${plane.cellWidth}`}
                data-pixel-grid-tone="dark"
                stroke="#000"
                strokeOpacity="0.52"
                strokeWidth={strokeWidths.horizontal * 2}
              />
              <path
                d={`M0 0V${plane.cellHeight}`}
                data-pixel-grid-tone="light"
                stroke="#fff"
                strokeOpacity="0.72"
                strokeWidth={strokeWidths.vertical}
              />
              <path
                d={`M0 0H${plane.cellWidth}`}
                data-pixel-grid-tone="light"
                stroke="#fff"
                strokeOpacity="0.72"
                strokeWidth={strokeWidths.horizontal}
              />
            </pattern>
          </defs>
          <rect fill={`url(#${id})`} height="100%" width="100%" />
        </svg>
      </div>
    </div>
  );
};

const useRasterSampleSize = (editor, nodeId, node) => {
  const runtime = editor.rasterSurface;
  const fallback = {
    height: Math.max(1, Math.round(node?.baseHeight ?? node?.height ?? 1)),
    width: Math.max(1, Math.round(node?.baseWidth ?? node?.width ?? 1)),
  };
  const subscribe = useCallback(
    (listener) => runtime?.subscribe?.(listener) || (() => undefined),
    [runtime]
  );
  const getSnapshot = useCallback(() => {
    const presentation = nodeId
      ? runtime?.getPresentation?.(nodeId) || null
      : null;

    return presentation
      ? `${presentation.width}:${presentation.height}`
      : `${fallback.width}:${fallback.height}`;
  }, [fallback.height, fallback.width, nodeId, runtime]);
  const [width, height] = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  )
    .split(":")
    .map(Number);

  return { height, width };
};
