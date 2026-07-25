import {
  getNodeScaleX,
  getNodeScaleY,
  getPixelGridTarget,
  getRasterPresentationPolicy,
} from "@punchpress/engine";
import { useCallback, useSyncExternalStore } from "react";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorSelectionDragSurfaceValue } from "../../../editor-react/use-editor-selection-drag-surface-value";
import {
  getPixelGridPlane,
  getPixelGridPreviewNode,
  getPixelGridStrokeWidths,
} from "../canvas-pixel-grid-math";
import { CanvasPixelGridPattern } from "../canvas-pixel-grid-pattern";

interface CanvasRasterPixelGridProps {
  baseHeight?: number;
  baseWidth?: number;
  baseX?: number;
  baseY?: number;
  height: number;
  nodeId: string;
  surface?: "crop" | "node";
  width: number;
}

export const CanvasRasterPixelGrid = ({
  baseHeight,
  baseWidth,
  baseX,
  baseY,
  height,
  nodeId,
  surface = "node",
  width,
}: CanvasRasterPixelGridProps) => {
  const editor = useEditor();
  const state = useEditorSelectionDragSurfaceValue((editor, store) => {
    const target = getRasterPresentationPolicy(store.viewport.zoom)
      .showPixelGrid
      ? getPixelGridTarget(editor)
      : null;
    const cropRect =
      store.rasterCropSession?.nodeId === nodeId
        ? store.rasterCropSession.rect
        : null;
    const isTarget =
      target?.kind === "raster" && target.sourceNodeId === nodeId;
    const shouldRender =
      isTarget && (surface === "crop" ? Boolean(cropRect) : !cropRect);
    const bounds = shouldRender
      ? cropRect || { height, width, x: 0, y: 0 }
      : null;

    return {
      bounds,
      devicePixelRatio:
        typeof window === "undefined" ? 1 : window.devicePixelRatio,
      node: shouldRender
        ? getPixelGridPreviewNode(
            editor.getNode(nodeId),
            editor.selectionDragPreview
          )
        : null,
      zoom: store.viewport.zoom,
    };
  });
  const sampleSize = useRasterSampleSize(editor, state.bounds ? nodeId : null, {
    baseHeight,
    baseWidth,
    height,
    width,
  });

  if (!(state.bounds && state.node)) {
    return null;
  }

  const plane = getPixelGridPlane(
    { baseHeight, baseWidth, baseX, baseY },
    sampleSize
  );
  const strokeWidths = getPixelGridStrokeWidths({
    devicePixelRatio: state.devicePixelRatio,
    scaleX: getNodeScaleX(state.node) ?? 1,
    scaleY: getNodeScaleY(state.node) ?? 1,
    zoom: state.zoom,
  });

  return (
    <CanvasPixelGridPattern
      bounds={state.bounds}
      kind="raster"
      nodeId={nodeId}
      plane={plane}
      sourceNodeId={nodeId}
      strokeWidths={strokeWidths}
    />
  );
};

const useRasterSampleSize = (editor, nodeId, node) => {
  const runtime = editor.rasterSurface;
  const fallback = {
    height: Math.max(1, Math.round(node.baseHeight ?? node.height)),
    width: Math.max(1, Math.round(node.baseWidth ?? node.width)),
  };
  const subscribe = useCallback(
    (listener) =>
      nodeId
        ? runtime?.subscribe?.(listener) || (() => undefined)
        : () => undefined,
    [nodeId, runtime]
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
