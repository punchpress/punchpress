import {
  getNodeLocalPoint,
  getNodeScaleX,
  getRasterPresentationPolicy,
} from "@punchpress/engine";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorSurfaceValue } from "../../../editor-react/use-editor-surface-value";
import { CanvasRasterPixelGrid } from "./canvas-raster-pixel-grid";

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
const RASTER_NODE_RENDER_READY_EVENT = "punchpress:raster-node-render-ready";
const RASTER_RENDER_READY_STABLE_FRAME_COUNT = 8;
const RASTER_RENDER_READY_MIN_STABLE_MS = 96;
const RASTER_DEBUG_MAX_RECORDS = 5000;
const RASTER_DEBUG_SNAPSHOT_ELEMENT_ID = "punchpress-raster-debug-json";

const rasterPreviewImageCache = new Map<string, Promise<HTMLImageElement>>();

const getRasterDomDebugSnapshot = () => {
  if (typeof document === "undefined") {
    return [];
  }

  return [...document.querySelectorAll("[data-raster-node-id]")].map((root) => {
    const workingSurface = root.querySelector("[data-raster-working-surface]");

    return {
      exactTileDomCount: root.querySelectorAll("[data-raster-tile-ref]").length,
      exactTilesReady:
        root.getAttribute("data-raster-exact-tiles-ready") || null,
      loadedExactTileCount: Number(
        root.getAttribute("data-raster-loaded-exact-tile-count") || 0
      ),
      nodeId: root.getAttribute("data-raster-node-id"),
      previewActive: root.getAttribute("data-raster-preview-active") === "true",
      previewEligible:
        root.getAttribute("data-raster-preview-eligible") === "true",
      previewReady:
        root.querySelector("[data-raster-preview-ready='true']") !== null,
      renderKeyLength: root.getAttribute("data-raster-render-key")?.length || 0,
      totalTileCount: Number(
        root.getAttribute("data-raster-total-tile-count") || 0
      ),
      visibleTileCount: Number(
        root.getAttribute("data-raster-visible-tile-count") || 0
      ),
      workingSurfaceCompleted:
        workingSurface?.getAttribute("data-raster-working-completed") || null,
      workingSurfaceType:
        workingSurface?.getAttribute("data-raster-working-surface") || null,
      workingTileDomCount: root.querySelectorAll(
        "[data-testid='raster-working-tile']"
      ).length,
      workingTileSurfaceCount: Number(
        workingSurface?.getAttribute("data-raster-working-tile-count") || 0
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
    workingSurfaces: editor.getBrushWorkingSurfaceStates?.().map((surface) => ({
      completed: surface.completed,
      nodeId: surface.nodeId,
      tileCount: surface.type === "tiles" ? surface.tiles.length : null,
      type: surface.type,
      workingSurfaceId: surface.workingSurfaceId,
    })),
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

      if (
        event.startsWith("brush.") ||
        event.startsWith("renderer.renderReady") ||
        event.startsWith("renderer.preview") ||
        event.startsWith("renderer.exactTiles")
      ) {
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

const dispatchRasterNodeRenderReady = ({ mode, nodeId, renderKey }) => {
  if (!(renderKey && typeof window !== "undefined")) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(RASTER_NODE_RENDER_READY_EVENT, {
      detail: {
        mode,
        nodeId,
        renderKey,
      },
    })
  );
  recordRasterDebugEvent("renderer.renderReady.dispatch", {
    mode,
    nodeId,
    renderKeyLength: renderKey.length,
  });
};

const hasBrushWorkingSurfaceForNode = (editor, nodeId) => {
  const surfaces = editor.getBrushWorkingSurfaceStates?.() || [];

  return surfaces.some((surface) => surface?.nodeId === nodeId);
};

const getImageLocalBounds = (node) => ({
  height: node.height,
  maxX: node.width,
  maxY: node.height,
  minX: 0,
  minY: 0,
  width: node.width,
});

const getViewportWorldCorners = (editor, state) => {
  const host = editor.hostRef;

  if (!host) {
    return null;
  }

  const rect = host.getBoundingClientRect();
  const viewport = state.viewport || editor.viewport;
  const zoom = Math.max(0.0001, viewport?.zoom || editor.zoom || 1);
  const minX = viewport.x;
  const minY = viewport.y;
  const maxX = viewport.x + rect.width / zoom;
  const maxY = viewport.y + rect.height / zoom;

  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
};

const getAncestorChain = (editor, node) => {
  const ancestors: (typeof node)[] = [];
  let currentNode = node;

  while (currentNode?.parentId && currentNode.parentId !== "root") {
    const parentNode = editor.getNode(currentNode.parentId);

    if (!parentNode) {
      break;
    }

    ancestors.unshift(parentNode);
    currentNode = parentNode;
  }

  return ancestors;
};

const getNodeLocalViewportBounds = (editor, state, node) => {
  const corners = getViewportWorldCorners(editor, state);

  if (!corners) {
    return null;
  }

  const ancestors = getAncestorChain(editor, node);
  const localPoints = corners.map((corner) => {
    let point = corner;

    for (const ancestor of ancestors) {
      const bounds = editor.getNodeTransformBounds(ancestor.id);

      if (!bounds) {
        return null;
      }

      point = getNodeLocalPoint(ancestor, bounds, point);
    }

    return getNodeLocalPoint(node, getImageLocalBounds(node), point);
  });

  if (localPoints.some((point) => !point)) {
    return null;
  }

  const xs = localPoints.map((point) => point.x);
  const ys = localPoints.map((point) => point.y);

  return {
    maxX: Math.max(...xs) + RASTER_TILE_CULL_PADDING,
    maxY: Math.max(...ys) + RASTER_TILE_CULL_PADDING,
    minX: Math.min(...xs) - RASTER_TILE_CULL_PADDING,
    minY: Math.min(...ys) - RASTER_TILE_CULL_PADDING,
  };
};

const getRasterTileCullState = (editor, state, nodeId, tileSources) => {
  const zoom = Math.max(0.0001, state.viewport?.zoom || editor.zoom || 1);
  const presentation = getRasterPresentationPolicy(zoom);
  const fallbackState = {
    bounds: null,
    previewKey: null,
    sampling: presentation.sampling,
    shouldBuildPreview: false,
    shouldUsePreview: false,
    tileSources,
    zoom,
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

  const bounds = getNodeLocalViewportBounds(editor, state, node);

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
  const pixelDensity = 1 / (zoom * nodeScale);
  const hasBrushWorkingSurface = hasBrushWorkingSurfaceForNode(editor, nodeId);
  const shouldBuildPreview =
    !hasBrushWorkingSurface &&
    presentation.sampling !== "exact" &&
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
    sampling: presentation.sampling,
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

            if (image) {
              context.drawImage(
                image,
                (tile.x - nextBounds.minX) * nextPreviewScale,
                (tile.y - nextBounds.minY) * nextPreviewScale,
                tile.width * nextPreviewScale,
                tile.height * nextPreviewScale
              );
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

const RasterTileImages = ({ onTileLoad, tileSources }) => {
  return tileSources.map((tile) => (
    <image
      data-raster-tile-ref={tile.ref}
      height={tile.height}
      href={tile.src}
      key={tile.ref}
      onLoad={() => onTileLoad?.(tile.ref)}
      pointerEvents="none"
      preserveAspectRatio="none"
      width={tile.width}
      x={tile.x}
      y={tile.y}
    />
  ));
};

const RasterWorkingCanvas = ({
  artworkOpacity = 1,
  canvas,
  height,
  pixelGridProps,
  testId,
  width,
  x,
  y,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;

    if (!(host && canvas)) {
      return;
    }

    canvas.style.display = "block";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.width = "100%";
    canvas.setAttribute("aria-hidden", "true");
    const previousParent = canvas.parentElement;
    const previousNextSibling = canvas.nextSibling;

    host.replaceChildren(canvas);

    return () => {
      if (canvas.parentElement === host) {
        host.removeChild(canvas);
      }

      if (previousParent?.isConnected) {
        previousParent.insertBefore(
          canvas,
          previousNextSibling?.parentNode === previousParent
            ? previousNextSibling
            : null
        );
      }
    };
  }, [canvas]);

  return (
    <foreignObject
      data-raster-working-canvas="true"
      data-testid={testId}
      height={height}
      pointerEvents="none"
      width={width}
      x={x}
      y={y}
    >
      <div
        data-raster-canvas-host="true"
        style={{
          height: "100%",
          overflow: "visible",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          ref={hostRef}
          style={{
            height: "100%",
            inset: 0,
            opacity: artworkOpacity,
            position: "absolute",
            width: "100%",
          }}
        />
        {pixelGridProps ? (
          <CanvasRasterPixelGrid
            {...pixelGridProps}
            htmlHost={{ height, width, x, y }}
            sampleHeight={canvas.height}
            sampleWidth={canvas.width}
          />
        ) : null}
      </div>
    </foreignObject>
  );
};

const RasterWorkingSurface = ({ artworkOpacity, pixelGridProps, surface }) => {
  if (!surface) {
    return null;
  }

  if (surface.type === "tiles") {
    return (
      <g
        data-raster-working-completed={surface.completed ? "true" : "false"}
        data-raster-working-surface="tiles"
        data-raster-working-tile-count={surface.tiles.length}
      >
        {surface.tiles.map((tile, index) => (
          <RasterWorkingCanvas
            canvas={tile.canvas}
            height={tile.height}
            key={`${surface.workingSurfaceId}:${tile.x}:${tile.y}:${index}`}
            testId="raster-working-tile"
            width={tile.width}
            x={tile.x}
            y={tile.y}
          />
        ))}
      </g>
    );
  }

  if (surface.type === "canvas") {
    return (
      <g
        data-raster-working-completed={surface.completed ? "true" : "false"}
        data-raster-working-surface="canvas"
      >
        <RasterWorkingCanvas
          artworkOpacity={artworkOpacity}
          canvas={surface.canvas}
          height={surface.height}
          pixelGridProps={pixelGridProps}
          testId="raster-working-canvas"
          width={surface.width}
          x={surface.x ?? 0}
          y={surface.y ?? 0}
        />
      </g>
    );
  }

  return null;
};

const CanvasTiledRasterImage = ({
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
}) => {
  const cullState = useEditorSurfaceValue((editor, state) =>
    getRasterTileCullState(editor, state, nodeId, tileSources)
  );
  const workingSurface = useEditorSurfaceValue((editor) =>
    editor.getBrushWorkingSurfaceStateForNode?.(nodeId)
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
  const visibleTileSources = cullState.tileSources;
  const rasterRenderKey = getRasterTileSourcesKey(tileSources);
  const visibleTileSourcesKey = getRasterTileSourcesKey(visibleTileSources);
  const isRasterPreviewReady =
    cullState.previewKey && readyRasterPreviewKey === cullState.previewKey;
  const [loadedExactTiles, setLoadedExactTiles] = useState<{
    key: string;
    refs: Set<string>;
  }>({
    key: "",
    refs: new Set(),
  });
  const areExactTilesReady =
    visibleTileSources.length === 0 ||
    (loadedExactTiles.key === visibleTileSourcesKey &&
      visibleTileSources.every((tile) => loadedExactTiles.refs.has(tile.ref)));
  const shouldHideExactTiles =
    cullState.shouldUsePreview && isRasterPreviewReady;

  useLayoutEffect(() => {
    setLoadedExactTiles({
      key: visibleTileSourcesKey,
      refs: new Set(),
    });
    recordRasterDebugEvent("renderer.exactTiles.reset", {
      nodeId,
      visibleTileCount: visibleTileSources.length,
      visibleTileSourcesKeyLength: visibleTileSourcesKey.length,
    });
  }, [nodeId, visibleTileSources.length, visibleTileSourcesKey]);
  const handleExactTileLoad = useCallback(
    (tileRef) => {
      setLoadedExactTiles((current) => {
        if (current.key !== visibleTileSourcesKey) {
          return current;
        }

        if (current.refs.has(tileRef)) {
          return current;
        }

        const refs = new Set(current.refs);

        refs.add(tileRef);
        recordRasterDebugEvent("renderer.exactTiles.load", {
          loadedExactTileCount: refs.size,
          nodeId,
          tileRef,
          visibleTileCount: visibleTileSources.length,
        });
        return {
          key: current.key,
          refs,
        };
      });
    },
    [nodeId, visibleTileSources.length, visibleTileSourcesKey]
  );

  useLayoutEffect(() => {
    recordRasterDebugEvent("renderer.exactTiles.readyState", {
      areExactTilesReady,
      loadedExactTileCount: loadedExactTiles.refs.size,
      nodeId,
      visibleTileCount: visibleTileSources.length,
    });
  }, [
    areExactTilesReady,
    loadedExactTiles.refs.size,
    nodeId,
    visibleTileSources.length,
  ]);

  useLayoutEffect(() => {
    if (!rasterRenderKey) {
      return;
    }

    if (cullState.shouldBuildPreview && !isRasterPreviewReady) {
      return;
    }

    if (!(cullState.shouldUsePreview || areExactTilesReady)) {
      return;
    }

    const mode = cullState.shouldUsePreview ? "preview" : "tiles";
    let frameId = 0;
    let isCancelled = false;
    let stableFrameCount = 0;
    const stableStartTime = performance.now();

    recordRasterDebugEvent("renderer.renderReady.schedule", {
      areExactTilesReady,
      isRasterPreviewReady,
      mode,
      nodeId,
      renderKeyLength: rasterRenderKey.length,
      shouldBuildPreview: cullState.shouldBuildPreview,
      shouldUsePreview: cullState.shouldUsePreview,
    });

    const waitForStablePaint = (timestamp: number) => {
      if (isCancelled) {
        return;
      }

      stableFrameCount += 1;
      const elapsedMs = timestamp - stableStartTime;

      if (
        stableFrameCount >= RASTER_RENDER_READY_STABLE_FRAME_COUNT &&
        elapsedMs >= RASTER_RENDER_READY_MIN_STABLE_MS
      ) {
        recordRasterDebugEvent("renderer.renderReady.stable", {
          elapsedMs,
          mode,
          nodeId,
          renderKeyLength: rasterRenderKey.length,
          stableFrameCount,
        });
        dispatchRasterNodeRenderReady({
          mode,
          nodeId,
          renderKey: rasterRenderKey,
        });
        return;
      }

      frameId = requestAnimationFrame(waitForStablePaint);
    };

    frameId = requestAnimationFrame(waitForStablePaint);

    return () => {
      isCancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [
    cullState.shouldBuildPreview,
    cullState.shouldUsePreview,
    areExactTilesReady,
    isRasterPreviewReady,
    nodeId,
    rasterRenderKey,
  ]);

  return (
    <g
      data-raster-exact-tiles-ready={areExactTilesReady ? "true" : "false"}
      data-raster-loaded-exact-tile-count={loadedExactTiles.refs.size}
      data-raster-node-id={nodeId}
      data-raster-preview-active={cullState.shouldUsePreview ? "true" : "false"}
      data-raster-preview-eligible={
        cullState.shouldBuildPreview ? "true" : "false"
      }
      data-raster-render-key={rasterRenderKey}
      data-raster-sampling={cullState.sampling}
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
        <RasterTileImages
          onTileLoad={handleExactTileLoad}
          tileSources={visibleTileSources}
        />
      )}
      <RasterWorkingSurface surface={workingSurface} />
    </g>
  );
};

export const CanvasRasterImage = (props) => {
  const residentSurface = useResidentRasterSurface(props);
  const sampling = useEditorSurfaceValue((_, state) => {
    return getRasterPresentationPolicy(state.viewport.zoom).sampling;
  });
  const workingSurface = useEditorSurfaceValue((editor) =>
    editor.getBrushWorkingSurfaceStateForNode?.(props.nodeId)
  );
  const pixelGridProps = {
    baseHeight: props.baseHeight,
    baseWidth: props.baseWidth,
    baseX: props.baseX,
    baseY: props.baseY,
    height: props.height,
    nodeId: props.nodeId,
    surface: props.pixelGridSurface,
    width: props.width,
  };
  let hasHtmlPixelGrid = false;
  let artwork: ReactNode;

  if (Array.isArray(props.tileSources) && props.tileSources.length > 0) {
    artwork = <CanvasTiledRasterImage {...props} transform={undefined} />;
  } else if (workingSurface?.type === "canvas") {
    hasHtmlPixelGrid = true;
    artwork = (
      <g
        data-raster-sampling={sampling}
        data-raster-working-replaces-node="true"
      >
        <RasterWorkingSurface
          artworkOpacity={props.opacity ?? 1}
          pixelGridProps={pixelGridProps}
          surface={workingSurface}
        />
      </g>
    );
  } else if (residentSurface) {
    hasHtmlPixelGrid = true;
    artwork = (
      <g
        data-raster-resident-surface="canvas2d"
        data-raster-sampling={sampling}
      >
        <RasterWorkingCanvas
          artworkOpacity={props.opacity ?? 1}
          canvas={residentSurface.canvas}
          height={props.baseHeight ?? props.height}
          pixelGridProps={pixelGridProps}
          testId="raster-resident-canvas"
          width={props.baseWidth ?? props.width}
          x={props.baseX ?? 0}
          y={props.baseY ?? 0}
        />
      </g>
    );
  } else {
    artwork = (
      <g data-raster-sampling={sampling} opacity={props.opacity ?? 1}>
        <image
          height={props.baseHeight ?? props.height}
          href={props.src}
          pointerEvents="none"
          preserveAspectRatio="none"
          width={props.baseWidth ?? props.width}
          x={props.baseX ?? 0}
          y={props.baseY ?? 0}
        />
        <RasterWorkingSurface surface={workingSurface} />
      </g>
    );
  }

  return (
    <g transform={props.transform || undefined}>
      {artwork}
      {hasHtmlPixelGrid ? null : <CanvasRasterPixelGrid {...pixelGridProps} />}
    </g>
  );
};

const useResidentRasterSurface = ({
  baseHeight,
  baseWidth,
  height,
  nodeId,
  src,
  tileSources,
  width,
}) => {
  const editor = useEditor();
  const runtime = editor.rasterSurface;
  const isEligible =
    Boolean(src) && !(Array.isArray(tileSources) && tileSources.length > 0);
  const surfaceHeight = baseHeight ?? height;
  const surfaceWidth = baseWidth ?? width;
  const subscribe = useCallback(
    (listener) => runtime?.subscribe?.(listener) || (() => undefined),
    [runtime]
  );
  const getSnapshot = useCallback(
    () => (isEligible ? runtime?.getPresentation?.(nodeId) || null : null),
    [isEligible, nodeId, runtime]
  );
  const presentation = useSyncExternalStore(subscribe, getSnapshot, () => null);

  useEffect(() => {
    if (!(isEligible && runtime?.ensureSurface)) {
      return;
    }

    let active = true;

    runtime
      .ensureSurface({
        height: Math.max(1, Math.round(surfaceHeight)),
        id: nodeId,
        src,
        width: Math.max(1, Math.round(surfaceWidth)),
      })
      .catch((error) => {
        if (active) {
          console.error("Failed to prepare Canvas2D Raster surface", error);
        }
      });

    return () => {
      active = false;
    };
  }, [isEligible, nodeId, runtime, src, surfaceHeight, surfaceWidth]);

  return presentation;
};
