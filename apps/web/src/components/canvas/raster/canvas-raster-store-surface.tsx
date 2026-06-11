import { useLayoutEffect, useRef } from "react";
import { useEditorSurfaceValue } from "../../../editor-react/use-editor-surface-value";
import { getNodeLocalViewportBounds } from "./raster-local-viewport";

const RASTER_SURFACE_PADDING = 256;
const RASTER_SURFACE_MAX_PIXELS = 8_000_000;

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
  }

  entry.context.putImageData(entry.imageData, 0, 0);
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
    revision: entry.store.revision,
    store: entry.store,
    zoom,
  };
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

export const CanvasRasterStoreSurface = ({ nodeId }) => {
  const surface = useEditorSurfaceValue((surfaceEditor, state) =>
    getStoreSurfaceState(surfaceEditor, state, nodeId)
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;

    if (!(canvas && surface)) {
      return;
    }

    const { store, zoom } = surface;
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

    const storeBounds = {
      maxX: bounds.maxX - surface.anchorX,
      maxY: bounds.maxY - surface.anchorY,
      minX: bounds.minX - surface.anchorX,
      minY: bounds.minY - surface.anchorY,
    };

    for (const tile of store.getTilesForBounds(storeBounds, {
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
  }, [surface]);

  if (!surface) {
    return null;
  }

  return (
    <foreignObject
      data-raster-store-hydrated={surface.hydrated ? "true" : "false"}
      data-raster-store-revision={surface.revision}
      data-raster-store-surface="true"
      height={surface.maxY - surface.minY}
      pointerEvents="none"
      width={surface.maxX - surface.minX}
      x={surface.minX}
      y={surface.minY}
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
    </foreignObject>
  );
};

export const hasRasterStoreSurface = (editor, nodeId) =>
  Boolean(editor.getRasterStoreEntry?.(nodeId));
