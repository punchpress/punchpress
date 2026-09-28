import { getPixelGridTarget, shouldShowPixelGrid } from "@punchpress/engine";
import { useCallback, useSyncExternalStore } from "react";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorSelectionDragPreviewValue } from "../../../editor-react/use-editor-selection-drag-preview-value";
import { useEditorSelectionDragSurfaceValue } from "../../../editor-react/use-editor-selection-drag-surface-value";
import { CanvasPixelGridLines } from "../canvas-pixel-grid-lines";
import {
  getPixelGridPlane,
  getPixelGridPreviewNode,
  getPixelGridStrokeWidths,
} from "../canvas-pixel-grid-math";
import { getRasterPresentationFootprint } from "./canvas-raster-presentation";

interface CanvasRasterPixelGridProps {
  baseHeight?: number;
  baseWidth?: number;
  baseX?: number;
  baseY?: number;
  displayPlane?: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
  height: number;
  htmlHost?: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
  nodeId: string;
  renderRootNodeId?: string;
  sampleHeight?: number;
  sampleWidth?: number;
  surface?: "crop" | "node";
  width: number;
}

export const CanvasRasterPixelGrid = ({
  baseHeight,
  baseWidth,
  baseX,
  baseY,
  displayPlane,
  height,
  htmlHost,
  nodeId,
  renderRootNodeId = nodeId,
  sampleHeight,
  sampleWidth,
  surface = "node",
  width,
}: CanvasRasterPixelGridProps) => {
  const editor = useEditor();
  const preview = useEditorSelectionDragPreviewValue(
    (editor) => editor.selectionDragPreview
  );
  const state = useEditorSelectionDragSurfaceValue((editor, store) => {
    const target = getPixelGridTarget(editor);
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
      node: shouldRender ? getPixelGridPreviewNode(target.node, preview) : null,
      zoom: store.viewport.zoom,
    };
  });
  const runtimeSampleSize = useRasterSampleSize(
    editor,
    state.bounds && !(sampleHeight && sampleWidth) ? nodeId : null,
    {
      baseHeight,
      baseWidth,
      height,
      width,
    }
  );

  if (!(state.bounds && state.node)) {
    return null;
  }

  const sampleSize = {
    height: sampleHeight || runtimeSampleSize.height,
    width: sampleWidth || runtimeSampleSize.width,
  };
  const presentedPlane = htmlHost ?? displayPlane;
  const displayedHeight = presentedPlane?.height ?? baseHeight ?? height;
  const displayedWidth = presentedPlane?.width ?? baseWidth ?? width;
  const footprint = getRasterPresentationFootprint(editor, {
    displayedHeight,
    displayedWidth,
    nodeId,
    renderRootNodeId,
    sampleHeight: sampleSize.height,
    sampleWidth: sampleSize.width,
    zoom: state.zoom,
  });

  if (!shouldShowPixelGrid(footprint)) {
    return null;
  }

  const planeNode = presentedPlane
    ? {
        baseHeight: presentedPlane.height,
        baseWidth: presentedPlane.width,
        baseX: presentedPlane.x,
        baseY: presentedPlane.y,
      }
    : { baseHeight, baseWidth, baseX, baseY };
  const plane = getPixelGridPlane(planeNode, sampleSize);
  const strokeWidths = getPixelGridStrokeWidths({
    devicePixelRatio: state.devicePixelRatio,
  });
  const bounds =
    presentedPlane && surface === "node" ? presentedPlane : state.bounds;
  const pattern = (
    <CanvasPixelGridLines
      bounds={bounds}
      kind="raster"
      layer={surface === "crop" ? 55 : 5}
      nodeId={nodeId}
      plane={plane}
      sourceNodeId={nodeId}
      strokeWidths={strokeWidths}
    />
  );

  if (htmlHost) {
    return (
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full"
        preserveAspectRatio="none"
        viewBox={`${htmlHost.x} ${htmlHost.y} ${htmlHost.width} ${htmlHost.height}`}
      >
        {pattern}
      </svg>
    );
  }

  return pattern;
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
