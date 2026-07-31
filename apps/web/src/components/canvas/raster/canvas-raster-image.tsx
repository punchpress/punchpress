import {
  deriveRasterAtomicHandoff,
  getNodeLocalPoint,
  getPixelGridTarget,
  getRasterSampling,
  type RasterAtomicHandoff,
  type RasterWorkingGroup,
  type RasterWorkingPresentation,
  shouldUseFullResolutionRasterSource,
} from "@punchpress/engine";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorSurfaceValue } from "../../../editor-react/use-editor-surface-value";
import {
  CanvasExactRaster,
  useExactRasterPresentation,
} from "./canvas-exact-raster";
import { CanvasNativeRasterImage } from "./canvas-native-raster-image";
import { CanvasRasterPixelGrid } from "./canvas-raster-pixel-grid";
import { getRasterPresentationFootprint } from "./canvas-raster-presentation";

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
    workingPresentations: editor
      .getRasterWorkingPresentations?.()
      .map((presentation) => ({
        groups: presentation.groups.map((group) => ({
          groupId: group.groupId,
          nodeId: group.nodeId,
          phase: group.phase,
          tileCount:
            group.content.kind === "tiles" ? group.content.tiles.length : null,
          type: group.content.kind,
        })),
        nodeId: presentation.nodeId,
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
        event.startsWith("renderer.presentation") ||
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

const getNodeRasterPixelFootprint = (
  editor,
  {
    displayedHeight,
    displayedWidth,
    nodeId,
    renderRootNodeId,
    sampleHeight,
    sampleWidth,
    zoom,
  }
) =>
  getRasterPresentationFootprint(editor, {
    displayedHeight,
    displayedWidth,
    nodeId,
    renderRootNodeId,
    sampleHeight,
    sampleWidth,
    zoom,
  });

const getGridPixelFootprint = (editor, nodeId, sourceFootprint, zoom) => {
  const target = getPixelGridTarget(editor);

  if (
    !target ||
    (target.kind === "raster" && target.sourceNodeId !== nodeId) ||
    (target.kind === "frame" &&
      !isNodeOwnedByFrame(editor, nodeId, target.node.id))
  ) {
    return sourceFootprint;
  }

  if (target.kind === "raster") {
    return sourceFootprint;
  }

  return getNodeRasterPixelFootprint(editor, {
    displayedHeight: 1,
    displayedWidth: 1,
    nodeId: target.node.id,
    renderRootNodeId: target.node.id,
    sampleHeight: 1,
    sampleWidth: 1,
    zoom,
  });
};

const isNodeOwnedByFrame = (editor, nodeId, frameId) => {
  let node = editor.getNode(nodeId);

  while (node?.parentId && node.parentId !== "root") {
    if (node.parentId === frameId) {
      return true;
    }

    node = editor.getNode(node.parentId);
  }

  return false;
};

const getRasterTileCullState = (
  editor,
  state,
  nodeId,
  renderRootNodeId,
  tileSources
) => {
  const zoom = Math.max(0.0001, state.viewport?.zoom || editor.zoom || 1);
  const node = editor.getNode(nodeId);
  const sourceFootprint = getNodeRasterPixelFootprint(editor, {
    displayedHeight: 1,
    displayedWidth: 1,
    nodeId,
    renderRootNodeId,
    sampleHeight: 1,
    sampleWidth: 1,
    zoom,
  });
  const gridFootprint = getGridPixelFootprint(
    editor,
    nodeId,
    sourceFootprint,
    zoom
  );
  const sampling = getRasterSampling(sourceFootprint);
  const useFullResolutionSource =
    shouldUseFullResolutionRasterSource(gridFootprint);
  const fallbackState = {
    bounds: null,
    previewKey: null,
    sampling,
    shouldBuildPreview: false,
    shouldUsePreview: false,
    tileSources,
    zoom,
  };

  if (!Array.isArray(tileSources) || tileSources.length === 0) {
    return fallbackState;
  }

  if (node?.type !== "image") {
    return fallbackState;
  }

  const viewportBounds = getNodeLocalViewportBounds(editor, state, node);

  if (!viewportBounds) {
    return fallbackState;
  }

  const visibleTileSources =
    tileSources.length > RASTER_TILE_CULL_THRESHOLD
      ? tileSources.filter((tile) => {
          return !(
            tile.x + tile.width < viewportBounds.minX ||
            tile.y + tile.height < viewportBounds.minY ||
            tile.x > viewportBounds.maxX ||
            tile.y > viewportBounds.maxY
          );
        })
      : tileSources;
  const pixelDensity =
    1 /
    Math.max(0.0001, Math.min(sourceFootprint.height, sourceFootprint.width));
  const shouldBuildPreview =
    !useFullResolutionSource &&
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
          ...viewportBounds,
          height: viewportBounds.maxY - viewportBounds.minY,
          width: viewportBounds.maxX - viewportBounds.minX,
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
          viewportBounds.minX,
          viewportBounds.minY,
          viewportBounds.maxX,
          viewportBounds.maxY,
          previewSourcesKey,
        ].join(":"),
    sampling,
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

const RasterTileImages = ({ onTileLoad, opacity = 1, tileSources }) => {
  return tileSources.map((tile) => (
    <image
      data-raster-tile-ref={tile.ref}
      height={tile.height}
      href={tile.src}
      key={tile.ref}
      onLoad={() => onTileLoad?.(tile.ref)}
      opacity={opacity}
      pointerEvents="none"
      preserveAspectRatio="none"
      width={tile.width}
      x={tile.x}
      y={tile.y}
    />
  ));
};

const RASTER_REPLACEMENT_DECODE_ATTEMPTS = 2;

const useRasterAtomicHandoff = ({
  mountedDrawableResourceIds,
  onBeforeAcknowledge,
  presentation,
  src,
  tileSources,
}: {
  mountedDrawableResourceIds?: ReadonlySet<string>;
  onBeforeAcknowledge?: (group: RasterWorkingGroup) => void;
  presentation: RasterWorkingPresentation | null;
  src?: string;
  tileSources: readonly { ref: string; src: string }[];
}): RasterAtomicHandoff => {
  const editor = useEditor();
  const failRasterPresentation = useCallback(
    (failure) => editor.failRasterPresentation(failure),
    [editor]
  );
  const [decodedResourceIds, setDecodedResourceIds] = useState(
    () => new Set<string>()
  );
  const discoveredReplacementSourceGroups = useMemo(
    () => getRasterReplacementSourceGroups(presentation, src, tileSources),
    [presentation, src, tileSources]
  );
  const replacementSourceGroups = useStableRasterReplacementSourceGroups(
    discoveredReplacementSourceGroups
  );

  useEffect(() => {
    let active = true;
    const activeResourceIds = new Set(
      replacementSourceGroups.flatMap(({ resourceIds }) => resourceIds)
    );

    setDecodedResourceIds((current) => {
      const retained = new Set(
        [...current].filter((resourceId) => activeResourceIds.has(resourceId))
      );

      return retained.size === current.size ? current : retained;
    });

    for (const group of replacementSourceGroups) {
      loadRasterReplacementGroup(group).then((isDrawable) => {
        if (!active) {
          return;
        }

        if (isDrawable) {
          setDecodedResourceIds((current) =>
            addRasterDrawableResources(current, group.resourceIds)
          );
          return;
        }

        recordRasterDebugEvent("renderer.presentation.fail", {
          commitId: group.commitId,
          groupId: group.groupId,
          nodeId: group.nodeId,
          reason: "decode-failed",
        });
        failRasterPresentation({
          commitId: group.commitId,
          groupId: group.groupId,
          nodeId: group.nodeId,
          reason: "decode-failed",
        });
      });
    }

    return () => {
      active = false;
    };
  }, [failRasterPresentation, replacementSourceGroups]);
  const drawableResourceIds = mountedDrawableResourceIds
    ? new Set(
        [...decodedResourceIds].filter((resourceId) =>
          mountedDrawableResourceIds.has(resourceId)
        )
      )
    : decodedResourceIds;

  const handoff = deriveRasterAtomicHandoff(
    presentation ?? { groups: [], nodeId: "" },
    drawableResourceIds
  );

  useLayoutEffect(() => {
    for (const acknowledgement of handoff.acknowledgements) {
      const group = handoff.layers.find(
        (layer) => layer.groupId === acknowledgement.groupId
      )?.group;

      if (group) {
        onBeforeAcknowledge?.(group);
      }
      recordRasterDebugEvent("renderer.presentation.acknowledge", {
        commitId: acknowledgement.commitId,
        groupId: acknowledgement.groupId,
        nodeId: acknowledgement.nodeId,
      });
      editor.acknowledgeRasterPresentation(acknowledgement);
    }
  }, [editor, handoff.acknowledgements, handoff.layers, onBeforeAcknowledge]);

  return handoff;
};

const getRasterReplacementSourceGroups = (
  presentation: RasterWorkingPresentation | null,
  src: string | undefined,
  tileSources: readonly { ref: string; src: string }[]
) => {
  const tileSourcesByRef = new Map(
    tileSources.map((tile) => [tile.ref, tile.src])
  );
  return (presentation?.groups ?? []).flatMap((group) => {
    const replacement = group.replacement;

    if (!(replacement && group.phase === "awaiting-presentation")) {
      return [];
    }

    const sources = replacement.resourceIds.flatMap((resourceId) => {
      let resourceSource: string | undefined;

      if (replacement.kind === "canvas") {
        resourceSource = resourceId === src ? src : undefined;
      } else {
        resourceSource = tileSourcesByRef.get(resourceId);
      }

      return resourceSource ? [resourceSource] : [];
    });

    return sources.length === replacement.resourceIds.length
      ? [
          {
            commitId: replacement.commitId,
            groupId: group.groupId,
            nodeId: group.nodeId,
            resourceIds: replacement.resourceIds,
            sources,
          },
        ]
      : [];
  });
};

const loadRasterReplacementGroup = async (group) => {
  for (
    let attempt = 1;
    attempt <= RASTER_REPLACEMENT_DECODE_ATTEMPTS;
    attempt += 1
  ) {
    try {
      await Promise.all(group.sources.map(loadRasterReplacementImage));
      return true;
    } catch {
      if (attempt === RASTER_REPLACEMENT_DECODE_ATTEMPTS) {
        return false;
      }
    }
  }

  return false;
};

const addRasterDrawableResources = (current, resourceIds) => {
  if (resourceIds.every((resourceId) => current.has(resourceId))) {
    return current;
  }

  const next = new Set(current);

  for (const resourceId of resourceIds) {
    next.add(resourceId);
  }
  return next;
};

const useStableRasterReplacementSourceGroups = (sourceGroups) => {
  const stableGroups = useRef(sourceGroups);

  if (
    !areRasterReplacementSourceGroupsEqual(stableGroups.current, sourceGroups)
  ) {
    stableGroups.current = sourceGroups;
  }

  return stableGroups.current;
};

const areRasterReplacementSourceGroupsEqual = (left, right) =>
  left.length === right.length &&
  left.every(
    (group, index) =>
      group.commitId === right[index].commitId &&
      group.groupId === right[index].groupId &&
      group.nodeId === right[index].nodeId &&
      areStringArraysEqual(group.resourceIds, right[index].resourceIds) &&
      areStringArraysEqual(group.sources, right[index].sources)
  );

const areStringArraysEqual = (
  left: readonly string[],
  right: readonly string[]
) =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

const loadRasterReplacementImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const RasterWorkingCanvas = ({
  artworkOpacity = 1,
  canvas,
  height,
  pixelGridProps = null,
  sampling = "smooth",
  subscribeToSource = undefined,
  testId,
  width,
  x,
  y,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const display = useMemo(
    () => ({ height, width, x, y }),
    [height, width, x, y]
  );
  const sampleSize = useMemo(
    () => ({ height: canvas.height, width: canvas.width }),
    [canvas]
  );
  const { presentation, surfaceRef } = useExactRasterPresentation({
    display,
    enabled: sampling === "exact" && artworkOpacity > 0,
    sampleSize,
  });
  const showsExactPresentation =
    sampling === "exact" && artworkOpacity > 0 && presentation;

  useLayoutEffect(() => {
    const host = hostRef.current;

    if (!(host && canvas)) {
      return;
    }

    canvas.style.display = showsExactPresentation ? "none" : "block";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.width = "100%";
    canvas.setAttribute("aria-hidden", "true");
    canvas.setAttribute("data-raster-source-canvas", "true");
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
  }, [canvas, showsExactPresentation]);

  return (
    <g
      data-raster-canvas-host="true"
      data-testid={`${testId}-surface`}
      ref={surfaceRef}
    >
      {/* Chromium quantizes foreignObject x/y before the outer SVG zoom. */}
      <g
        transform={`translate(${
          showsExactPresentation ? presentation.bounds.x : x
        } ${showsExactPresentation ? presentation.bounds.y : y})`}
      >
        {/* The canvas clips its bitmap; foreignObject clipping quantizes fractional extents. */}
        <foreignObject
          data-raster-working-canvas="true"
          data-testid={testId}
          height={showsExactPresentation ? presentation.bounds.height : height}
          overflow="visible"
          pointerEvents="none"
          width={showsExactPresentation ? presentation.bounds.width : width}
          x={0}
          y={0}
        >
          <div
            style={{
              height: "100%",
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
            {showsExactPresentation ? (
              <CanvasExactRaster
                opacity={artworkOpacity}
                presentation={presentation}
                source={canvas}
                subscribeToSource={subscribeToSource}
              />
            ) : null}
          </div>
        </foreignObject>
      </g>
      {pixelGridProps ? (
        <CanvasRasterPixelGrid
          {...pixelGridProps}
          displayPlane={display}
          sampleHeight={canvas.height}
          sampleWidth={canvas.width}
        />
      ) : null}
    </g>
  );
};

const RasterWorkingGroupLayer = ({
  artworkOpacity = 1,
  group,
  pixelGridProps = null,
  sampling,
}: {
  artworkOpacity?: number;
  group: RasterWorkingGroup;
  pixelGridProps?: Record<string, unknown> | null;
  sampling: string;
}) => {
  if (group.content.kind === "tiles") {
    return (
      <g
        data-raster-working-completed={
          group.phase === "active" ? "false" : "true"
        }
        data-raster-working-group-id={group.groupId}
        data-raster-working-phase={group.phase}
        data-raster-working-surface="tiles"
        data-raster-working-tile-count={group.content.tiles.length}
      >
        {group.content.tiles.map((tile, index) => (
          <RasterWorkingCanvas
            canvas={tile.canvas}
            height={tile.height}
            key={`${group.groupId}:${tile.x}:${tile.y}:${index}`}
            sampling={sampling}
            subscribeToSource={tile.subscribeToSource}
            testId="raster-working-tile"
            width={tile.width}
            x={tile.x}
            y={tile.y}
          />
        ))}
      </g>
    );
  }

  if (group.content.kind === "canvas") {
    return (
      <g
        data-raster-working-completed={
          group.phase === "active" ? "false" : "true"
        }
        data-raster-working-group-id={group.groupId}
        data-raster-working-phase={group.phase}
        data-raster-working-surface="canvas"
      >
        <RasterWorkingCanvas
          artworkOpacity={artworkOpacity}
          canvas={group.content.canvas}
          height={group.content.height}
          pixelGridProps={pixelGridProps}
          sampling={sampling}
          testId="raster-working-canvas"
          width={group.content.width}
          x={group.content.x}
          y={group.content.y}
        />
      </g>
    );
  }

  return null;
};

const RasterTiledArtwork = ({
  baseHeight,
  baseWidth,
  baseX,
  baseY,
  handleTileLoad,
  handoff,
  height,
  replacementTileSources,
  sampling,
  shouldHideExactTiles,
  src,
  tileSources,
  width,
}) => {
  const replacementResourceIds = new Set(
    handoff.layers.flatMap(({ group }) => [
      ...(group.replacement?.resourceIds ?? []),
    ])
  );
  const stableTileSources = tileSources.filter(
    (tile) =>
      !(
        replacementResourceIds.has(tile.ref) ||
        handoff.hiddenReplacementResourceIds.has(tile.ref)
      )
  );
  const nodeReplacementLayer = handoff.layers.find(
    ({ group }) => group.replacesNode
  );
  const renderBaseImage = (key?: string) =>
    src ? (
      <image
        height={baseHeight ?? height}
        href={src}
        key={key}
        pointerEvents="none"
        preserveAspectRatio="none"
        width={baseWidth ?? width}
        x={baseX ?? 0}
        y={baseY ?? 0}
      />
    ) : null;
  const renderHandoffLayer = (layer) => {
    const { group } = layer;

    if (group.replacement?.kind === "tiles") {
      const resourceIds = new Set(group.replacement.resourceIds);

      return (
        <g key={group.groupId}>
          <RasterTileImages
            onTileLoad={handleTileLoad}
            opacity={
              layer.kind === "replacement" && !shouldHideExactTiles ? 1 : 0
            }
            tileSources={replacementTileSources.filter((tile) =>
              resourceIds.has(tile.ref)
            )}
          />
          {layer.kind === "working" ? (
            <g transform={getRasterWorkingGroupTransform(group)}>
              <RasterWorkingGroupLayer group={group} sampling={sampling} />
            </g>
          ) : null}
        </g>
      );
    }

    if (layer.kind === "replacement" && group.replacement?.kind === "canvas") {
      return renderBaseImage(group.groupId);
    }

    return (
      <g key={group.groupId} transform={getRasterWorkingGroupTransform(group)}>
        <RasterWorkingGroupLayer group={group} sampling={sampling} />
      </g>
    );
  };

  return (
    <>
      {nodeReplacementLayer
        ? renderHandoffLayer(nodeReplacementLayer)
        : renderBaseImage()}
      {shouldHideExactTiles ? null : (
        <RasterTileImages
          onTileLoad={handleTileLoad}
          tileSources={stableTileSources}
        />
      )}
      {handoff.layers
        .filter((layer) => layer !== nodeReplacementLayer)
        .map(renderHandoffLayer)}
    </>
  );
};

const CanvasTiledRasterImage = ({
  baseHeight,
  baseWidth,
  baseX,
  baseY,
  height,
  nodeId,
  opacity,
  renderRootNodeId = nodeId,
  src,
  tileSources,
  transform,
  width,
}) => {
  const cullState = useEditorSurfaceValue((editor, state) =>
    getRasterTileCullState(editor, state, nodeId, renderRootNodeId, tileSources)
  );
  const workingPresentation = useEditorSurfaceValue((editor) =>
    editor.getRasterWorkingPresentation?.(nodeId)
  );
  const acknowledgedReplacementGroups = useRef(
    new Map<string, RasterWorkingGroup>()
  );
  const previousWorkingGroups = useRef<readonly RasterWorkingGroup[]>([]);
  const currentWorkingGroups = workingPresentation?.groups ?? [];
  const currentWorkingGroupIds = new Set(
    currentWorkingGroups.map((group) => group.groupId)
  );

  for (const previousGroup of previousWorkingGroups.current) {
    if (
      previousGroup.phase === "awaiting-presentation" &&
      previousGroup.replacement &&
      !currentWorkingGroupIds.has(previousGroup.groupId)
    ) {
      acknowledgedReplacementGroups.current.set(
        previousGroup.groupId,
        previousGroup
      );
    }
  }
  previousWorkingGroups.current = currentWorkingGroups;
  const [loadedTileRefs, setLoadedTileRefs] = useState(() => new Set<string>());
  const [readyRasterPreviewKey, setReadyRasterPreviewKey] = useState(null);
  const retainAcknowledgedReplacement = useCallback(
    (group: RasterWorkingGroup) => {
      acknowledgedReplacementGroups.current.set(group.groupId, group);
    },
    []
  );
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
  const isRasterPreviewReady =
    Boolean(cullState.previewKey) &&
    readyRasterPreviewKey === cullState.previewKey;
  const shouldUsePreview = cullState.shouldUsePreview;
  const handoff = useRasterAtomicHandoff({
    mountedDrawableResourceIds:
      shouldUsePreview && !isRasterPreviewReady
        ? new Set<string>()
        : loadedTileRefs,
    onBeforeAcknowledge: retainAcknowledgedReplacement,
    presentation: workingPresentation,
    src,
    tileSources,
  });
  const liveGroupIds = new Set(
    handoff.layers.map((layer) => layer.group.groupId)
  );
  const retainedReplacementLayers = [
    ...acknowledgedReplacementGroups.current.values(),
  ]
    .filter(
      (retainedGroup) =>
        !liveGroupIds.has(retainedGroup.groupId) &&
        handoff.layers.some(
          ({ group }) => group.sequence < retainedGroup.sequence
        )
    )
    .map((group) => ({
      group,
      groupId: group.groupId,
      kind: "replacement" as const,
    }));
  const orderedHandoff = {
    ...handoff,
    layers: [...handoff.layers, ...retainedReplacementLayers].sort(
      (left, right) => left.group.sequence - right.group.sequence
    ),
  };
  useLayoutEffect(() => {
    for (const [
      groupId,
      retainedGroup,
    ] of acknowledgedReplacementGroups.current) {
      const hasEarlierVisibleGroup = handoff.layers.some(
        ({ group }) => group.sequence < retainedGroup.sequence
      );

      if (!hasEarlierVisibleGroup) {
        acknowledgedReplacementGroups.current.delete(groupId);
      }
    }
  }, [handoff.layers]);
  const handleExactTileLoad = useCallback((tileRef) => {
    setLoadedTileRefs((current) => {
      if (current.has(tileRef)) {
        return current;
      }

      const next = new Set(current);

      next.add(tileRef);
      return next;
    });
  }, []);
  const awaitingGroupCount =
    workingPresentation?.groups.filter(
      (group) => group.phase === "awaiting-presentation"
    ).length ?? 0;
  const arePresentedTilesReady =
    awaitingGroupCount === handoff.acknowledgements.length;
  const shouldHideExactTiles = shouldUsePreview && isRasterPreviewReady;
  const hasWorkingLayer = orderedHandoff.layers.some(
    (layer) => layer.kind === "working"
  );
  let presentationOwner = "exact";

  if (shouldHideExactTiles) {
    presentationOwner = "preview";
  }
  if (hasWorkingLayer) {
    presentationOwner = "working";
  }

  return (
    <g
      data-raster-atomic-handoff={awaitingGroupCount > 0 ? "true" : "false"}
      data-raster-exact-tiles-ready={arePresentedTilesReady ? "true" : "false"}
      data-raster-loaded-exact-tile-count={loadedTileRefs.size}
      data-raster-node-id={nodeId}
      data-raster-presentation-owner={presentationOwner}
      data-raster-preview-active={shouldUsePreview ? "true" : "false"}
      data-raster-preview-eligible={
        cullState.shouldBuildPreview ? "true" : "false"
      }
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
          shouldShow={shouldHideExactTiles}
          tileSources={visibleTileSources}
          zoom={cullState.zoom}
        />
      ) : null}
      <RasterTiledArtwork
        baseHeight={baseHeight}
        baseWidth={baseWidth}
        baseX={baseX}
        baseY={baseY}
        handleTileLoad={handleExactTileLoad}
        handoff={orderedHandoff}
        height={height}
        replacementTileSources={tileSources}
        sampling={cullState.sampling}
        shouldHideExactTiles={shouldHideExactTiles}
        src={src}
        tileSources={visibleTileSources}
        width={width}
      />
    </g>
  );
};

const getRasterWorkingGroupTransform = ({ matrix }) =>
  `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`;

export const CanvasRasterImage = (props) => {
  const editor = useEditor();
  const residentSurface = useResidentRasterSurface(props);
  const workingPresentation = useEditorSurfaceValue((editor) =>
    editor.getRasterWorkingPresentation?.(props.nodeId)
  );
  const zoom = useEditorSurfaceValue((_, state) => state.viewport.zoom);
  const sampling = getCanvasRasterSampling({
    editor,
    props,
    residentSurface,
    workingPresentation,
    zoom,
  });
  const subscribeToResidentSource = useCallback(
    (listener: () => void) =>
      editor.rasterSurface?.subscribePresentation?.(props.nodeId, listener) ??
      (() => undefined),
    [editor, props.nodeId]
  );
  const pixelGridProps = {
    baseHeight: props.baseHeight,
    baseWidth: props.baseWidth,
    baseX: props.baseX,
    baseY: props.baseY,
    height: props.height,
    nodeId: props.nodeId,
    renderRootNodeId: props.renderRootNodeId ?? props.nodeId,
    surface: props.pixelGridSurface,
    width: props.width,
  };
  let artwork: ReactNode;

  if (Array.isArray(props.tileSources) && props.tileSources.length > 0) {
    artwork = (
      <>
        <CanvasTiledRasterImage {...props} transform={undefined} />
        <CanvasRasterPixelGrid {...pixelGridProps} />
      </>
    );
  } else {
    artwork = (
      <CanvasRasterWorkingPresentation
        pixelGridProps={pixelGridProps}
        presentation={workingPresentation}
        props={props}
        residentSurface={residentSurface}
        sampling={sampling}
        subscribeToResidentSource={subscribeToResidentSource}
      />
    );
  }

  return <g transform={props.transform || undefined}>{artwork}</g>;
};

const CanvasRasterWorkingPresentation = ({
  pixelGridProps,
  presentation,
  props,
  residentSurface,
  sampling,
  subscribeToResidentSource,
}) => {
  const handoff = useRasterAtomicHandoff({
    presentation,
    src: props.src,
    tileSources: [],
  });
  const awaitingGroupCount =
    presentation?.groups.filter(
      (group) => group.phase === "awaiting-presentation"
    ).length ?? 0;
  const hasNodeReplacement = Boolean(
    presentation?.groups.some((group) => group.replacesNode)
  );
  const renderCommitted = (key?: string) =>
    residentSurface ? (
      <g
        data-raster-resident-surface="canvas2d"
        data-raster-sampling={sampling}
        key={key}
      >
        <RasterWorkingCanvas
          artworkOpacity={props.opacity ?? 1}
          canvas={residentSurface.canvas}
          height={props.baseHeight ?? props.height}
          pixelGridProps={pixelGridProps}
          sampling={sampling}
          subscribeToSource={subscribeToResidentSource}
          testId="raster-resident-canvas"
          width={props.baseWidth ?? props.width}
          x={props.baseX ?? 0}
          y={props.baseY ?? 0}
        />
      </g>
    ) : (
      <CanvasNativeRasterImage
        {...props}
        artworkOpacity={props.opacity ?? 1}
        key={key}
        pixelGridProps={pixelGridProps}
        renderRootNodeId={props.renderRootNodeId ?? props.nodeId}
        sampling={sampling}
      />
    );

  return (
    <g
      data-raster-atomic-handoff={awaitingGroupCount > 0 ? "true" : "false"}
      data-raster-node-id={props.nodeId}
    >
      {hasNodeReplacement ? null : renderCommitted()}
      {handoff.layers.map((layer) => {
        if (layer.kind === "replacement") {
          return renderCommitted(layer.groupId);
        }

        return (
          <g
            data-raster-working-replaces-node={
              layer.group.replacesNode ? "true" : "false"
            }
            key={layer.groupId}
            transform={getRasterWorkingGroupTransform(layer.group)}
          >
            <RasterWorkingGroupLayer
              artworkOpacity={props.opacity ?? 1}
              group={layer.group}
              pixelGridProps={layer.group.replacesNode ? pixelGridProps : null}
              sampling={sampling}
            />
          </g>
        );
      })}
    </g>
  );
};

const getCanvasRasterSampling = ({
  editor,
  props,
  residentSurface,
  workingPresentation,
  zoom,
}) => {
  const workingCanvasGroup = workingPresentation?.groups.find(
    (group) => group.content.kind === "canvas"
  );
  const workingCanvas =
    workingCanvasGroup?.content.kind === "canvas"
      ? workingCanvasGroup.content
      : null;
  const displayedHeight =
    workingCanvas?.height ?? props.baseHeight ?? props.height;
  const displayedWidth = workingCanvas?.width ?? props.baseWidth ?? props.width;
  const sampleHeight =
    workingCanvas?.canvas.height ??
    residentSurface?.height ??
    Math.max(1, Math.round(displayedHeight));
  const sampleWidth =
    workingCanvas?.canvas.width ??
    residentSurface?.width ??
    Math.max(1, Math.round(displayedWidth));

  return getRasterSampling(
    getNodeRasterPixelFootprint(editor, {
      displayedHeight,
      displayedWidth,
      nodeId: props.nodeId,
      renderRootNodeId: props.renderRootNodeId ?? props.nodeId,
      sampleHeight,
      sampleWidth,
      zoom,
    })
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
