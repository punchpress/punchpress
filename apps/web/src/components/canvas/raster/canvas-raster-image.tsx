import { getNodeScaleX } from "@punchpress/engine";
import { memo, useCallback, useLayoutEffect, useRef, useState } from "react";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorSurfaceValue } from "../../../editor-react/use-editor-surface-value";
import { CanvasRasterStoreSurface } from "./canvas-raster-store-surface";
import { getNodeLocalViewportBounds } from "./raster-local-viewport";

interface RasterDebugRecord {
  event: string;
  payload: Record<string, unknown>;
  t: number;
}

interface RasterDebugCapture {
  armFrameCapture: (durationMs?: number) => void;
  clear: () => void;
  enabled: boolean;
  getRecords: () => RasterDebugRecord[];
  record: (event: string, payload?: Record<string, unknown>) => void;
  records: RasterDebugRecord[];
  snapshot: () => {
    editor: unknown;
    records: RasterDebugRecord[];
    rasterDom: unknown;
  };
  stop: () => void;
}

declare global {
  interface Window {
    __PUNCHPRESS_RASTER_DEBUG__?: RasterDebugCapture;
  }
}

const RASTER_TILE_CULL_PADDING = 1024;
const RASTER_TILE_CULL_THRESHOLD = 128;
const RASTER_TILE_PREVIEW_DENSITY_THRESHOLD = 8;
const RASTER_TILE_PREVIEW_TILE_THRESHOLD = RASTER_TILE_CULL_THRESHOLD;
const RASTER_TILE_PREVIEW_MAX_PIXELS = 4_000_000;
const RASTER_TILE_PREVIEW_OVERSAMPLE = 2;
const RASTER_DEBUG_MAX_RECORDS = 5000;
const RASTER_DEBUG_SNAPSHOT_ELEMENT_ID = "punchpress-raster-debug-json";

const rasterPreviewImageCache = new Map<string, Promise<HTMLImageElement>>();

const getRasterDomDebugSnapshot = () => {
  if (typeof document === "undefined") {
    return [];
  }

  return [...document.querySelectorAll("[data-raster-node-id]")].map((root) => {
    return {
      exactTileDomCount: root.querySelectorAll("[data-raster-tile-ref]").length,
      nodeId: root.getAttribute("data-raster-node-id"),
      previewActive: root.getAttribute("data-raster-preview-active") === "true",
      previewEligible:
        root.getAttribute("data-raster-preview-eligible") === "true",
      previewReady:
        root.querySelector("[data-raster-preview-ready='true']") !== null,
      totalTileCount: Number(
        root.getAttribute("data-raster-total-tile-count") || 0
      ),
      visibleTileCount: Number(
        root.getAttribute("data-raster-visible-tile-count") || 0
      ),
    };
  });
};

const getRasterEditorDebugSnapshot = () => {
  const editor = window.__PUNCHPRESS_EDITOR__;

  if (!editor) {
    return null;
  }

  return {
    activeTool: editor.activeTool,
    imageNodes: editor.nodes
      .filter((node) => node.type === "image")
      .map((node) => ({
        baseHeight: node.baseHeight ?? null,
        baseWidth: node.baseWidth ?? null,
        baseX: node.baseX ?? null,
        baseY: node.baseY ?? null,
        height: node.height,
        id: node.id,
        parentId: node.parentId,
        tileSourceCount: node.tileSources?.length || 0,
        transform: node.transform,
        width: node.width,
      })),
    selectedNodeIds: editor.selectedNodeIds,
    viewport: editor.viewport,
  };
};

const installRasterDebugCapture = () => {
  if (typeof window === "undefined" || !import.meta.env.DEV) {
    return null;
  }

  if (window.__PUNCHPRESS_RASTER_DEBUG__) {
    return window.__PUNCHPRESS_RASTER_DEBUG__;
  }

  let frameId = 0;
  let frameCaptureUntil = 0;
  let publishTimeoutId = 0;
  const getSnapshotElement = () => {
    let element = document.getElementById(RASTER_DEBUG_SNAPSHOT_ELEMENT_ID);

    if (element) {
      return element;
    }

    element = document.createElement("script");
    element.id = RASTER_DEBUG_SNAPSHOT_ELEMENT_ID;
    element.setAttribute("type", "application/json");
    document.head.appendChild(element);
    return element;
  };
  const publishSnapshot = () => {
    publishTimeoutId = 0;
    getSnapshotElement().textContent = JSON.stringify(capture.snapshot());
  };
  const scheduleSnapshotPublish = () => {
    if (publishTimeoutId) {
      return;
    }

    publishTimeoutId = window.setTimeout(publishSnapshot, 100);
  };
  const capture: RasterDebugCapture = {
    armFrameCapture(durationMs = 3000) {
      frameCaptureUntil = Math.max(
        frameCaptureUntil,
        performance.now() + durationMs
      );

      if (frameId) {
        return;
      }

      const tick = () => {
        frameId = 0;

        if (!(capture.enabled && performance.now() <= frameCaptureUntil)) {
          return;
        }

        capture.record("renderer.frame", {
          editor: getRasterEditorDebugSnapshot(),
          rasterDom: getRasterDomDebugSnapshot(),
        });
        frameId = requestAnimationFrame(tick);
      };

      frameId = requestAnimationFrame(tick);
    },
    clear() {
      capture.records = [];
      scheduleSnapshotPublish();
    },
    enabled: true,
    getRecords() {
      return [...capture.records];
    },
    record(event, payload = {}) {
      if (!capture.enabled) {
        return;
      }

      capture.records.push({
        event,
        payload,
        t: performance.now(),
      });

      if (capture.records.length > RASTER_DEBUG_MAX_RECORDS) {
        capture.records.splice(
          0,
          capture.records.length - RASTER_DEBUG_MAX_RECORDS
        );
      }

      if (event.startsWith("brush.") || event.startsWith("renderer.preview")) {
        capture.armFrameCapture(3500);
      }

      scheduleSnapshotPublish();
    },
    records: [],
    snapshot() {
      return {
        editor: getRasterEditorDebugSnapshot(),
        rasterDom: getRasterDomDebugSnapshot(),
        records: capture.getRecords(),
      };
    },
    stop() {
      capture.enabled = false;
      frameCaptureUntil = 0;
      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
    },
  };

  window.__PUNCHPRESS_RASTER_DEBUG__ = capture;
  publishSnapshot();
  return capture;
};

const recordRasterDebugEvent = (
  event: string,
  payload: Record<string, unknown> = {}
) => {
  const capture = installRasterDebugCapture();

  capture?.record(event, payload);
};

installRasterDebugCapture();

const getRasterTileSourcesKey = (tileSources) =>
  tileSources.map((tile) => tile.ref).join("|");

const getRasterTileCullState = (editor, state, nodeId, tileSources) => {
  const fallbackState = {
    bounds: null,
    previewKey: null,
    shouldBuildPreview: false,
    shouldUsePreview: false,
    tileSources,
  };

  if (
    !Array.isArray(tileSources) ||
    tileSources.length <= RASTER_TILE_CULL_THRESHOLD
  ) {
    return fallbackState;
  }

  const node = editor.getNode(nodeId);

  if (node?.type !== "image") {
    return fallbackState;
  }

  const bounds = getNodeLocalViewportBounds(
    editor,
    state,
    node,
    RASTER_TILE_CULL_PADDING
  );

  if (!bounds) {
    return fallbackState;
  }

  const visibleTileSources = tileSources.filter((tile) => {
    return !(
      tile.x + tile.width < bounds.minX ||
      tile.y + tile.height < bounds.minY ||
      tile.x > bounds.maxX ||
      tile.y > bounds.maxY
    );
  });
  const nodeScale = Math.max(0.0001, Math.abs(getNodeScaleX(node) || 1));
  const zoom = Math.max(0.0001, state.viewport?.zoom || editor.zoom || 1);
  const pixelDensity = 1 / (zoom * nodeScale);
  const shouldBuildPreview =
    visibleTileSources.length > RASTER_TILE_PREVIEW_TILE_THRESHOLD &&
    pixelDensity >= RASTER_TILE_PREVIEW_DENSITY_THRESHOLD;
  const previewBounds = {
    height: node.height,
    maxX: node.width,
    maxY: node.height,
    minX: 0,
    minY: 0,
    width: node.width,
  };
  const previewTileSources = shouldBuildPreview
    ? tileSources
    : visibleTileSources;
  const previewSourcesKey = getRasterTileSourcesKey(previewTileSources);

  return {
    bounds: shouldBuildPreview
      ? previewBounds
      : {
          ...bounds,
          height: bounds.maxY - bounds.minY,
          width: bounds.maxX - bounds.minX,
        },
    previewKey: shouldBuildPreview
      ? [
          previewBounds.minX,
          previewBounds.minY,
          previewBounds.maxX,
          previewBounds.maxY,
          previewSourcesKey,
        ].join(":")
      : [
          bounds.minX,
          bounds.minY,
          bounds.maxX,
          bounds.maxY,
          previewSourcesKey,
        ].join(":"),
    shouldBuildPreview,
    shouldUsePreview: shouldBuildPreview,
    tileSources: previewTileSources,
    zoom,
  };
};

const getRasterPreviewImage = (src) => {
  const cachedImage = rasterPreviewImageCache.get(src);

  if (cachedImage) {
    return cachedImage;
  }

  const imagePromise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

  rasterPreviewImageCache.set(src, imagePromise);
  return imagePromise;
};

const getRasterPreviewScale = (bounds, zoom) => {
  const baseScale = Math.min(
    1,
    Math.max(0.01, (zoom || 0.01) * RASTER_TILE_PREVIEW_OVERSAMPLE)
  );
  const width = Math.max(1, bounds?.width || 1);
  const height = Math.max(1, bounds?.height || 1);
  const projectedPixels = width * baseScale * height * baseScale;

  if (projectedPixels <= RASTER_TILE_PREVIEW_MAX_PIXELS) {
    return baseScale;
  }

  return (
    baseScale * Math.sqrt(RASTER_TILE_PREVIEW_MAX_PIXELS / projectedPixels)
  );
};

const RasterTilePreviewCanvas = ({
  bounds,
  onReadyChange,
  previewKey,
  shouldShow,
  tileSources,
  zoom,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewStateRef = useRef({
    bounds,
    previewScale: getRasterPreviewScale(bounds, zoom),
    tileSources,
  });
  const [isReady, setIsReady] = useState(false);
  const previewScale = getRasterPreviewScale(bounds, zoom);
  previewStateRef.current = {
    bounds,
    previewScale,
    tileSources,
  };

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const previewState = previewStateRef.current;
    const nextBounds = previewState.bounds;
    const nextPreviewScale = previewState.previewScale;
    const nextTileSources = previewState.tileSources;

    if (!(canvas && nextBounds && previewKey)) {
      return;
    }

    let isCanceled = false;
    const width = Math.max(1, Math.ceil(nextBounds.width * nextPreviewScale));
    const height = Math.max(1, Math.ceil(nextBounds.height * nextPreviewScale));
    const nextCanvas = document.createElement("canvas");
    const context = nextCanvas.getContext("2d", { alpha: true });

    nextCanvas.width = width;
    nextCanvas.height = height;

    setIsReady(false);
    onReadyChange(previewKey, false);

    if (!context) {
      return;
    }

    context.clearRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;

    const uniqueSources = [...new Set(nextTileSources.map((tile) => tile.src))];

    Promise.all(uniqueSources.map((src) => getRasterPreviewImage(src)))
      .then((images) => {
        if (isCanceled) {
          return;
        }

        const imagesBySource = new Map(
          uniqueSources.map((src, index) => [src, images[index]])
        );
        let tileIndex = 0;

        context.clearRect(0, 0, width, height);

        // Snap tile EDGES (not origins) to integer canvas pixels: abutting
        // tiles share the exact same snapped edge, so fractional per-tile
        // destination rects cannot under-cover shared-edge pixels and open
        // bright seam lines under GPU raster.
        const snapX = (localX) =>
          Math.round((localX - nextBounds.minX) * nextPreviewScale);
        const snapY = (localY) =>
          Math.round((localY - nextBounds.minY) * nextPreviewScale);
        const drawNextChunk = () => {
          if (isCanceled) {
            return;
          }

          const startedAt = performance.now();

          while (
            tileIndex < nextTileSources.length &&
            performance.now() - startedAt < 4
          ) {
            const tile = nextTileSources[tileIndex];
            const image = imagesBySource.get(tile.src);
            const x0 = snapX(tile.x);
            const x1 = snapX(tile.x + tile.width);
            const y0 = snapY(tile.y);
            const y1 = snapY(tile.y + tile.height);

            if (image && x1 > x0 && y1 > y0) {
              context.drawImage(image, x0, y0, x1 - x0, y1 - y0);
            }

            tileIndex += 1;
          }

          if (tileIndex < nextTileSources.length) {
            requestAnimationFrame(drawNextChunk);
            return;
          }

          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d", { alpha: true })?.drawImage(nextCanvas, 0, 0);
          setIsReady(true);
          onReadyChange(previewKey, true);
        };

        drawNextChunk();
      })
      .catch(() => {
        if (!isCanceled) {
          setIsReady(false);
          onReadyChange(previewKey, false);
        }
      });

    return () => {
      isCanceled = true;
    };
  }, [onReadyChange, previewKey]);

  if (!bounds) {
    return null;
  }

  return (
    <foreignObject
      data-raster-preview-ready={isReady ? "true" : "false"}
      data-raster-preview-tile-count={tileSources.length}
      height={bounds.height}
      opacity={shouldShow && isReady ? 1 : 0}
      pointerEvents="none"
      width={bounds.width}
      x={bounds.minX}
      y={bounds.minY}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          height: "100%",
          width: "100%",
        }}
      />
    </foreignObject>
  );
};

const RasterTileImages = ({ tileSources }) => {
  return tileSources.map((tile) => (
    <image
      data-raster-tile-ref={tile.ref}
      height={tile.height}
      href={tile.src}
      key={tile.ref}
      pointerEvents="none"
      preserveAspectRatio="none"
      width={tile.width}
      x={tile.x}
      y={tile.y}
    />
  ));
};

const CanvasTiledRasterImage = memo(function CanvasTiledRasterImageInner({
  baseHeight,
  baseWidth,
  baseX,
  baseY,
  height,
  nodeId,
  opacity,
  src,
  tileSources,
  transform,
  width,
}) {
  const editor = useEditor();
  const cullState = useEditorSurfaceValue((currentEditor, state) =>
    getRasterTileCullState(currentEditor, state, nodeId, tileSources)
  );
  const [readyRasterPreviewKey, setReadyRasterPreviewKey] = useState(null);
  const handleRasterPreviewReadyChange = useCallback(
    (previewKey, isReady) => {
      recordRasterDebugEvent("renderer.preview.readyChange", {
        isReady,
        nodeId,
        previewKeyLength: previewKey?.length || 0,
      });
      setReadyRasterPreviewKey((currentPreviewKey) => {
        if (isReady) {
          return previewKey;
        }

        return currentPreviewKey === previewKey ? null : currentPreviewKey;
      });
    },
    [nodeId]
  );
  // Tile manifests carry refs only; pixel bytes live in the editor's raster
  // asset store. Resolve cached object URLs for the DOM fallback renderer.
  const visibleTileSources = cullState.tileSources.flatMap((tile) => {
    const resolvedSrc = editor.rasterAssets?.getObjectUrl(tile.ref);

    return resolvedSrc ? [{ ...tile, src: resolvedSrc }] : [];
  });
  const isRasterPreviewReady =
    cullState.previewKey && readyRasterPreviewKey === cullState.previewKey;
  const shouldHideExactTiles =
    cullState.shouldUsePreview && isRasterPreviewReady;

  return (
    <g
      data-raster-node-id={nodeId}
      data-raster-preview-active={cullState.shouldUsePreview ? "true" : "false"}
      data-raster-preview-eligible={
        cullState.shouldBuildPreview ? "true" : "false"
      }
      data-raster-total-tile-count={tileSources.length}
      data-raster-visible-tile-count={visibleTileSources.length}
      opacity={opacity ?? 1}
      transform={transform || undefined}
    >
      {cullState.shouldBuildPreview ? (
        <RasterTilePreviewCanvas
          bounds={cullState.bounds}
          onReadyChange={handleRasterPreviewReadyChange}
          previewKey={cullState.previewKey}
          shouldShow={cullState.shouldUsePreview}
          tileSources={visibleTileSources}
          zoom={cullState.zoom}
        />
      ) : null}
      {src ? (
        <image
          height={baseHeight ?? height}
          href={src}
          pointerEvents="none"
          preserveAspectRatio="none"
          width={baseWidth ?? width}
          x={baseX ?? 0}
          y={baseY ?? 0}
        />
      ) : null}
      {shouldHideExactTiles ? null : (
        <RasterTileImages tileSources={visibleTileSources} />
      )}
    </g>
  );
});

export const CanvasRasterImage = (props) => {
  const editor = useEditor();
  const storeState = useEditorSurfaceValue((surfaceEditor) => {
    const entry = surfaceEditor.getRasterStoreEntry?.(props.nodeId);

    return {
      exists: Boolean(entry),
      hydrated: Boolean(entry?.hydrated),
    };
  });
  // While the store streams hydration, the committed-DOM fallback renders a
  // manifest FROZEN at store-entry creation: the store surface above it
  // draws every merged commit, and re-rendering the live manifest here
  // would re-resolve thousands of just-replaced payload refs into object
  // URLs (content hashing) on every commit — a multi-second frame on
  // fully-brushed layers. Transform and opacity stay live via the wrapper.
  const frozenFallbackRef = useRef(null);
  const entry = editor.getRasterStoreEntry?.(props.nodeId) || null;

  if (!entry) {
    frozenFallbackRef.current = null;
  } else if (frozenFallbackRef.current?.entry !== entry) {
    frozenFallbackRef.current = {
      entry,
      props: {
        baseHeight: props.baseHeight,
        baseWidth: props.baseWidth,
        baseX: props.baseX,
        baseY: props.baseY,
        height: props.height,
        nodeId: props.nodeId,
        src: props.src,
        tileSources: props.tileSources,
        width: props.width,
      },
    };
  }

  const fallbackProps = frozenFallbackRef.current?.props || props;
  const hasTileSources =
    Array.isArray(fallbackProps.tileSources) &&
    fallbackProps.tileSources.length > 0;

  if (storeState.hydrated) {
    return (
      <CanvasRasterStoreSurface
        nodeId={props.nodeId}
        opacity={props.opacity ?? 1}
      />
    );
  }

  if (storeState.exists) {
    return (
      <g opacity={props.opacity ?? 1} transform={props.transform || undefined}>
        {hasTileSources ? (
          <CanvasTiledRasterImage
            {...fallbackProps}
            opacity={1}
            transform={undefined}
          />
        ) : (
          <image
            height={fallbackProps.height}
            href={fallbackProps.src}
            pointerEvents="none"
            preserveAspectRatio="none"
            width={fallbackProps.width}
            x={0}
            y={0}
          />
        )}
        <CanvasRasterStoreSurface
          nodeId={props.nodeId}
          opacity={props.opacity ?? 1}
        />
      </g>
    );
  }

  if (hasTileSources) {
    return <CanvasTiledRasterImage {...props} />;
  }

  return (
    <g opacity={props.opacity ?? 1} transform={props.transform || undefined}>
      <image
        height={props.height}
        href={props.src}
        pointerEvents="none"
        preserveAspectRatio="none"
        width={props.width}
        x={0}
        y={0}
      />
    </g>
  );
};
