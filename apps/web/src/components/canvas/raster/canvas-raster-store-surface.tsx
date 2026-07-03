import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorSurfaceValue } from "../../../editor-react/use-editor-surface-value";
import { drawRasterSurface } from "./raster-surface-renderer";

const getStoreSurfaceState = (editor, state, nodeId) => {
  const entry = editor.getRasterStoreEntry?.(nodeId);

  if (!entry) {
    return null;
  }

  const node = editor.getNode(nodeId);

  if (node?.type !== "image") {
    return null;
  }

  const frame = editor.getNodeRenderFrame(nodeId);
  const hostRect = editor.hostRef?.getBoundingClientRect();

  if (!(frame && hostRect && hostRect.width > 0 && hostRect.height > 0)) {
    return null;
  }

  const overlays = editor.getRasterStrokeOverlaysForNode?.(nodeId) || [];

  return {
    anchorX: entry.anchorX,
    anchorY: entry.anchorY,
    devicePixelRatio:
      typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
    frameHeight: Math.max(1, frame.bounds.height),
    frameTransform: frame.transform || "",
    frameWidth: Math.max(1, frame.bounds.width),
    frameX: frame.bounds.minX,
    frameY: frame.bounds.minY,
    hostHeight: hostRect.height,
    hostWidth: hostRect.width,
    hydrated: entry.hydrated,
    revision: entry.store.revision,
    strokeKey: overlays
      .map((overlay) => `${overlay.operation}:${overlay.revision}`)
      .join("|"),
    viewportX: state.viewport?.x ?? editor.viewport?.x ?? 0,
    viewportY: state.viewport?.y ?? editor.viewport?.y ?? 0,
    zoom: Math.max(0.0001, state.viewport?.zoom || editor.zoom || 1),
  };
};

/**
 * Always-screen-space raster compositor. The canvas backing store is device
 * resolution (viewport CSS px x devicePixelRatio) and never represents world
 * or local extents. It mounts in the host-anchored raster surface layer --
 * axis-aligned and exactly viewport-sized at any zoom, far under Blink's
 * paint-cull horizon. (Mounting inside the node shell with an inverse
 * transform re-enters the ~16384 px cull in shell-local space and truncates
 * the surface mid-viewport.) Every repaint draws tiles at integer store
 * coordinates through one shared store->device transform.
 */
export const CanvasRasterStoreSurface = ({ nodeId, opacity = 1 }) => {
  const editor = useEditor();
  const surface = useEditorSurfaceValue((surfaceEditor, state) =>
    getStoreSurfaceState(surfaceEditor, state, nodeId)
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostDivRef = useRef<HTMLDivElement | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(editor.rasterSurfaceLayer || null);
  }, [editor]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const hostDiv = hostDivRef.current;

    if (!(canvas && hostDiv && surface)) {
      return;
    }

    hostDiv.style.width = `${surface.hostWidth}px`;
    hostDiv.style.height = `${surface.hostHeight}px`;
    drawRasterSurface(canvas, editor, nodeId, surface);
  }, [editor, nodeId, surface]);

  if (!(surface && host)) {
    return null;
  }

  return createPortal(
    <div
      data-raster-store-hydrated={surface.hydrated ? "true" : "false"}
      data-raster-store-revision={surface.revision}
      data-raster-store-surface="true"
      ref={hostDivRef}
      style={{
        left: 0,
        opacity,
        pointerEvents: "none",
        position: "absolute",
        top: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          height: "100%",
          pointerEvents: "none",
          width: "100%",
        }}
      />
    </div>,
    host
  );
};

export const hasRasterStoreSurface = (editor, nodeId) =>
  Boolean(editor.getRasterStoreEntry?.(nodeId));
