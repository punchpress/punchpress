import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorSurfaceValue } from "../../../editor-react/use-editor-surface-value";
import { getNodeLocalViewportBounds } from "./raster-local-viewport";

const RASTER_SURFACE_PADDING = 256;
const RASTER_SURFACE_MAX_PIXELS = 8_000_000;
/**
 * Blink paints world-space content through a cull rect that stops around
 * 16384 CSS px, so any in-world element spanning more local pixels than that
 * truncates at a raster-tile boundary (512 * 2^k local px at power-of-two
 * zoom buckets -- lines that look exactly like pyramid tile seams) or is
 * culled entirely. Surfaces wider or taller than this span render through
 * the screen-space raster surface layer instead of the node shell. The
 * margin below 16384 covers the cull rect's viewport-relative anchor.
 */
const RASTER_SURFACE_MAX_LOCAL_SPAN = 12_000;

interface TileCanvasEntry {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  imageData: ImageData;
  revision: number;
}

const tileCanvasCache = new WeakMap<object, TileCanvasEntry>();

const getTileCanvas = (tile) => {
  let entry = tileCanvasCache.get(tile);

  if (entry && entry.revision === tile.revision) {
    return entry.canvas;
  }

  // This cache is the sole consumer of the store's per-tile sync rect:
  // snapshot it, clear it, and resync only the changed pixels. A missing rect
  // on a changed revision falls back to a full-tile resync.
  const syncRect = tile.syncRect;

  tile.syncRect = null;

  if (!entry) {
    const canvas = document.createElement("canvas");

    canvas.width = tile.width;
    canvas.height = tile.height;

    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    entry = {
      canvas,
      context,
      imageData: new ImageData(tile.pixels, tile.width, tile.height),
      revision: -1,
    };
    tileCanvasCache.set(tile, entry);
    entry.context.putImageData(entry.imageData, 0, 0);
    entry.revision = tile.revision;
    return entry.canvas;
  }

  const rect = syncRect
    ? {
        height:
          Math.min(tile.height, syncRect.maxY) - Math.max(0, syncRect.minY),
        width: Math.min(tile.width, syncRect.maxX) - Math.max(0, syncRect.minX),
        x: Math.max(0, syncRect.minX),
        y: Math.max(0, syncRect.minY),
      }
    : null;

  if (rect && rect.width > 0 && rect.height > 0) {
    entry.context.putImageData(
      entry.imageData,
      0,
      0,
      rect.x,
      rect.y,
      rect.width,
      rect.height
    );
  } else {
    entry.context.putImageData(entry.imageData, 0, 0);
  }

  entry.revision = tile.revision;
  return entry.canvas;
};

const intersectBounds = (a, b) => {
  const minX = Math.max(a.minX, b.minX);
  const minY = Math.max(a.minY, b.minY);
  const maxX = Math.min(a.maxX, b.maxX);
  const maxY = Math.min(a.maxY, b.maxY);

  if (maxX <= minX || maxY <= minY) {
    return null;
  }

  return { maxX, maxY, minX, minY };
};

const getStoreSurfaceState = (editor, state, nodeId) => {
  const entry = editor.getRasterStoreEntry?.(nodeId);

  if (!entry) {
    return null;
  }

  const node = editor.getNode(nodeId);

  if (node?.type !== "image") {
    return null;
  }

  const viewportBounds = getNodeLocalViewportBounds(
    editor,
    state,
    node,
    RASTER_SURFACE_PADDING
  );
  const painted = entry.store.getPaintedBounds();
  const contentBounds = painted
    ? {
        maxX: Math.max(node.width, painted.maxX + entry.anchorX),
        maxY: Math.max(node.height, painted.maxY + entry.anchorY),
        minX: Math.min(0, painted.minX + entry.anchorX),
        minY: Math.min(0, painted.minY + entry.anchorY),
      }
    : { maxX: node.width, maxY: node.height, minX: 0, minY: 0 };
  const overlays = editor.getRasterStrokeOverlaysForNode?.(nodeId) || [];

  for (const overlay of overlays) {
    const overlayPainted = overlay.strokeStore.getPaintedBounds();

    if (!overlayPainted) {
      continue;
    }

    contentBounds.maxX = Math.max(contentBounds.maxX, overlayPainted.maxX);
    contentBounds.maxY = Math.max(contentBounds.maxY, overlayPainted.maxY);
    contentBounds.minX = Math.min(contentBounds.minX, overlayPainted.minX);
    contentBounds.minY = Math.min(contentBounds.minY, overlayPainted.minY);
  }

  const bounds = viewportBounds
    ? intersectBounds(contentBounds, viewportBounds)
    : contentBounds;

  if (!bounds) {
    return null;
  }

  const zoom = Math.max(0.0001, state.viewport?.zoom || editor.zoom || 1);

  return {
    anchorX: entry.anchorX,
    anchorY: entry.anchorY,
    hydrated: entry.hydrated,
    maxX: bounds.maxX,
    maxY: bounds.maxY,
    minX: bounds.minX,
    minY: bounds.minY,
    nodeHeight: node.height,
    nodeWidth: node.width,
    revision: entry.store.revision,
    rotation: node.transform.rotation || 0,
    scaleX: node.transform.scaleX || 1,
    scaleY: node.transform.scaleY || 1,
    store: entry.store,
    strokeKey: overlays
      .map((overlay) => `${overlay.operation}:${overlay.revision}`)
      .join("|"),
    viewportX: state.viewport?.x ?? editor.viewport?.x ?? 0,
    viewportY: state.viewport?.y ?? editor.viewport?.y ?? 0,
    x: node.transform.x,
    y: node.transform.y,
    zoom,
  };
};

const drawStoreTiles = (context, surface, bounds, scale) => {
  const storeBounds = {
    maxX: bounds.maxX - surface.anchorX,
    maxY: bounds.maxY - surface.anchorY,
    minX: bounds.minX - surface.anchorX,
    minY: bounds.minY - surface.anchorY,
  };

  for (const tile of surface.store.getTilesForBounds(storeBounds, {
    create: false,
  })) {
    const tileCanvas = getTileCanvas(tile);

    if (!tileCanvas) {
      continue;
    }

    context.drawImage(
      tileCanvas,
      (tile.x + surface.anchorX - bounds.minX) * scale,
      (tile.y + surface.anchorY - bounds.minY) * scale,
      tile.width * scale,
      tile.height * scale
    );
  }
};

const drawPyramidTiles = (context, pyramid, surface, bounds, scale, level) => {
  const levelSpan = surface.store.tileSize * 2 ** level;
  const storeBounds = {
    maxX: bounds.maxX - surface.anchorX,
    maxY: bounds.maxY - surface.anchorY,
    minX: bounds.minX - surface.anchorX,
    minY: bounds.minY - surface.anchorY,
  };
  const minCol = Math.floor(storeBounds.minX / levelSpan);
  const maxCol = Math.floor((storeBounds.maxX - 1) / levelSpan);
  const minRow = Math.floor(storeBounds.minY / levelSpan);
  const maxRow = Math.floor((storeBounds.maxY - 1) / levelSpan);

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const tile = pyramid.getTile(level, col, row);

      if (!tile) {
        continue;
      }

      context.drawImage(
        tile.canvas,
        (col * levelSpan + surface.anchorX - bounds.minX) * scale,
        (row * levelSpan + surface.anchorY - bounds.minY) * scale,
        levelSpan * scale,
        levelSpan * scale
      );
    }
  }
};

const drawCommittedStore = (
  context,
  editor,
  nodeId,
  surface,
  bounds,
  scale
) => {
  const pyramid = editor.rasterStores?.getPyramid?.(nodeId) || null;
  const level = pyramid ? pyramid.getLevelForScale(scale) : 0;

  if (pyramid && level > 0) {
    pyramid.beginFrame();
    drawPyramidTiles(context, pyramid, surface, bounds, scale, level);
    return;
  }

  drawStoreTiles(context, surface, bounds, scale);
};

const drawStrokeOverlays = (context, overlays, bounds, scale) => {
  for (const overlay of overlays) {
    context.globalCompositeOperation =
      overlay.operation === "erase" ? "destination-out" : "source-over";

    for (const tile of overlay.strokeStore.getTilesForBounds(bounds, {
      create: false,
    })) {
      if (tile.merged) {
        continue;
      }

      const tileCanvas = getTileCanvas(tile);

      if (!tileCanvas) {
        continue;
      }

      context.drawImage(
        tileCanvas,
        (tile.x - bounds.minX) * scale,
        (tile.y - bounds.minY) * scale,
        tile.width * scale,
        tile.height * scale
      );
    }
  }

  context.globalCompositeOperation = "source-over";
};

const getSurfaceScale = (bounds, zoom) => {
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const baseScale = Math.min(1, Math.max(0.01, zoom));
  const projectedPixels = width * baseScale * height * baseScale;

  if (projectedPixels <= RASTER_SURFACE_MAX_PIXELS) {
    return baseScale;
  }

  return baseScale * Math.sqrt(RASTER_SURFACE_MAX_PIXELS / projectedPixels);
};

export const CanvasRasterStoreSurface = ({ nodeId, opacity = 1 }) => {
  const editor = useEditor();
  const surface = useEditorSurfaceValue((surfaceEditor, state) =>
    getStoreSurfaceState(surfaceEditor, state, nodeId)
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hosts, setHosts] = useState<{
    layer: HTMLElement | null;
    node: HTMLElement | null;
  }>({ layer: null, node: null });

  useEffect(() => {
    setHosts({
      layer: editor.rasterSurfaceLayer || null,
      node: editor.getNodeElement?.(nodeId) || null,
    });
  }, [editor, nodeId]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;

    if (!(canvas && surface)) {
      return;
    }

    const { zoom } = surface;
    const bounds = {
      maxX: surface.maxX,
      maxY: surface.maxY,
      minX: surface.minX,
      minY: surface.minY,
    };
    const scale = getSurfaceScale(bounds, zoom);
    const width = Math.max(1, Math.round((bounds.maxX - bounds.minX) * scale));
    const height = Math.max(1, Math.round((bounds.maxY - bounds.minY) * scale));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.clearRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = scale < 0.25 ? "high" : "medium";

    if (surface.hydrated) {
      drawCommittedStore(context, editor, nodeId, surface, bounds, scale);
    }

    drawStrokeOverlays(
      context,
      editor.getRasterStrokeOverlaysForNode?.(nodeId) || [],
      bounds,
      scale
    );
  }, [editor, nodeId, surface]);

  if (!surface) {
    return null;
  }

  const width = surface.maxX - surface.minX;
  const height = surface.maxY - surface.minY;
  const screenSpace =
    width > RASTER_SURFACE_MAX_LOCAL_SPAN ||
    height > RASTER_SURFACE_MAX_LOCAL_SPAN;
  const host = screenSpace ? hosts.layer : hosts.node;

  if (!host) {
    return null;
  }

  const dataAttributes = {
    "data-raster-store-hydrated": surface.hydrated ? "true" : "false",
    "data-raster-store-revision": surface.revision,
    "data-raster-store-surface": "true",
  };

  if (screenSpace) {
    // Zoomed out past the Blink paint cull span: render at screen resolution
    // in the host-anchored raster surface layer. The outer div reproduces the
    // node shell's box and transform in screen pixels.
    const { zoom } = surface;
    const transform =
      surface.rotation || surface.scaleX !== 1 || surface.scaleY !== 1
        ? `rotate(${surface.rotation}deg) scale(${surface.scaleX}, ${surface.scaleY})`
        : undefined;

    return createPortal(
      <div
        {...dataAttributes}
        style={{
          height: surface.nodeHeight * zoom,
          left: (surface.x - surface.viewportX) * zoom,
          opacity,
          pointerEvents: "none",
          position: "absolute",
          top: (surface.y - surface.viewportY) * zoom,
          transform,
          transformOrigin: "center center",
          width: surface.nodeWidth * zoom,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            height: height * zoom,
            left: surface.minX * zoom,
            pointerEvents: "none",
            position: "absolute",
            top: surface.minY * zoom,
            width: width * zoom,
          }}
        />
      </div>,
      host
    );
  }

  // Portaled into the node shell so the canvas lives in HTML rather than SVG
  // foreignObject (foreignObject content cannot direct-composite). The shell
  // carries the node transform, so local coordinates and clipping apply.
  return createPortal(
    <div
      {...dataAttributes}
      style={{
        height,
        left: surface.minX,
        opacity,
        pointerEvents: "none",
        position: "absolute",
        top: surface.minY,
        width,
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
