// @ts-nocheck TODO(typecheck-baseline): raster runtime exempt — in-flight redesign owns these files
import { getImageNodeBounds } from "../nodes/image/image-capabilities";
import { getNodeScaleX } from "../nodes/text/model";
import { incrementPerfCounter, measurePerf } from "../perf/perf-hooks";
import { PERF_SPANS } from "../perf/perf-labels";
import {
  clipRasterSegmentToTarget,
  createRasterStroke,
} from "../raster/stroke";
import { createRasterDabGenerator } from "../raster/dab-generator";
import { getRasterStrokeReach } from "../raster/settings";
import {
  getNodeTransformForPinnedWorldPoint,
  getNodeWorldPoint,
} from "../primitives/rotation";
import { createRasterPathSmoother } from "../raster/path-smoother";
import {
  acknowledgeRasterWorkingGroup,
  createRasterWorkingGroupLifecycle,
  getRasterWorkingToNodeMatrix,
  invalidateRasterWorkingGroup,
  markRasterWorkingGroupAwaitingReplacement,
  markRasterWorkingGroupCommitting,
  markRasterWorkingGroupPresentationFailed,
} from "../raster/working-presentation";
import {
  getBrushDabRenderBounds,
  getBrushDabRenderRadius,
  getErasedAlpha,
  getPaintedAlpha,
  getRasterDabCoverageAtPoint,
} from "./brush-mask";
import {
  cancelRasterFrame,
  canScheduleRasterFrame,
  createCanvas,
  getRasterCanvasBounds,
  getNow,
  hasRasterRuntime,
  loadImageToCanvas,
  requestRasterFrame,
} from "./brush-runtime";
import { DEFAULT_BRUSH_SETTINGS, getBrushColorRgb } from "./brush-settings";
import {
  getArtboardClipSourceRect,
  getImageLocalClipBounds,
  getImageLocalClipPolygon,
  getImageLocalPoint,
  getImageNodeCroppedToSourceRect,
  getNodeArtboardClipBounds,
  getRasterTargetState,
  getRasterWritableBounds,
  getRasterWritablePolygon,
  materializeBrushTarget,
  resolveBrushTargetState,
} from "./brush-target";
import { RASTER_TILE_SIZE, RasterTileSurface } from "./raster-tile-surface";
import { selectToolFromShortcut, Tool } from "./tool";

const BRUSH_LAYER_EXPANSION_PADDING_MULTIPLIER = 8;
const BRUSH_STROKE_POINT_FLUSH_BUDGET_MS = 5;
const BRUSH_TILE_ASYNC_COMMIT_THRESHOLD = 16;
const BRUSH_TILE_COMMIT_BUDGET_MS = 8;
const RESIDENT_RASTER_MAX_EDGE = 2048;
const TILED_BRUSH_SURFACE_AREA_THRESHOLD = 4096 * 4096;
const TILED_BRUSH_SURFACE_DENSITY_THRESHOLD = 8;
const NATIVE_PATH_EPSILON = 1e-6;
let brushWorkingSurfaceRevision = 0;
let brushTileCommitRevision = 0;
let brushPresentationCommitRevision = 0;

const recordRasterDebugEvent = (event, payload = {}) => {
  const capture = (
    globalThis as {
      __PUNCHPRESS_RASTER_DEBUG__?: {
        record?: (event: string, payload?: Record<string, unknown>) => void;
      };
    }
  ).__PUNCHPRESS_RASTER_DEBUG__;

  capture?.record?.(`brush.${event}`, payload);
};

const getRasterDebugNodePayload = (node) => {
  if (node?.type !== "image") {
    return null;
  }

  return {
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
  };
};

const clamp = (value, min, max) => {
  return Math.min(max, Math.max(min, value));
};

const pointsEqual = (first, second) =>
  Math.abs(first.x - second.x) <= NATIVE_PATH_EPSILON &&
  Math.abs(first.y - second.y) <= NATIVE_PATH_EPSILON;

const getNativePathBounds = (points, settings) => {
  const radius = getBrushDabRenderRadius(settings.size, settings.hardness);

  return {
    maxX: Math.ceil(Math.max(...points.map((point) => point.x)) + radius),
    maxY: Math.ceil(Math.max(...points.map((point) => point.y)) + radius),
    minX: Math.floor(Math.min(...points.map((point) => point.x)) - radius),
    minY: Math.floor(Math.min(...points.map((point) => point.y)) - radius),
  };
};

const getBrushLayerExpansionPadding = (settings) => {
  return Math.max(
    2,
    Math.ceil(settings.size * BRUSH_LAYER_EXPANSION_PADDING_MULTIPLIER)
  );
};

const shouldUseNativeStroke = (settings) => {
  return (
    settings.angle === 0 &&
    settings.angleJitter === 0 &&
    settings.flow === 1 &&
    settings.hardness >= 1 &&
    settings.opacity >= 1 &&
    settings.roundness === 1 &&
    settings.scatter === 0 &&
    settings.sizeJitter === 0 &&
    settings.spacing <= 0 &&
    settings.tip.kind === "round"
  );
};

const shouldUseTiledPaintSurface = ({
  editor,
  forceTiled = false,
  node,
  operation,
  sourceRect,
}) => {
  const zoom = Math.max(0.0001, editor?.viewport?.zoom || editor?.zoom || 1);
  const nodeScale = Math.max(0.0001, Math.abs(getNodeScaleX(node) || 1));
  const pixelDensity = 1 / (zoom * nodeScale);
  const writableBounds = getRasterWritableBounds(editor, node);
  const surfaceArea =
    (writableBounds?.width ?? node.width) *
    (writableBounds?.height ?? node.height);

  return (
    operation === "paint" &&
    !sourceRect &&
    ((node.tileSources || []).length > 0 ||
      forceTiled ||
      surfaceArea >= TILED_BRUSH_SURFACE_AREA_THRESHOLD ||
      pixelDensity >= TILED_BRUSH_SURFACE_DENSITY_THRESHOLD)
  );
};

const getAlphaBounds = (imageData) => {
  const { data, height, width } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] === 0) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  return maxX < 0 ? null : { maxX, maxY, minX, minY };
};

const createCanvasCopy = (sourceCanvas, sourceRect) => {
  const canvas = createCanvas(sourceRect.width, sourceRect.height);
  const context = canvas?.getContext("2d", { willReadFrequently: true });

  if (!(canvas && context)) {
    return null;
  }

  context.drawImage(
    sourceCanvas,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    0,
    0,
    sourceRect.width,
    sourceRect.height
  );

  return canvas;
};

const getRasterPlaneBounds = (node, tileSources = []) => {
  const bounds = [
    {
      maxX: node.width,
      maxY: node.height,
      minX: 0,
      minY: 0,
    },
  ];

  if (node.src) {
    const baseX = node.baseX ?? 0;
    const baseY = node.baseY ?? 0;

    bounds.push({
      maxX: baseX + (node.baseWidth ?? node.width),
      maxY: baseY + (node.baseHeight ?? node.height),
      minX: baseX,
      minY: baseY,
    });
  }

  for (const tileSource of tileSources) {
    bounds.push({
      maxX: tileSource.x + tileSource.width,
      maxY: tileSource.y + tileSource.height,
      minX: tileSource.x,
      minY: tileSource.y,
    });
  }

  return {
    maxX: Math.max(...bounds.map((bounds) => bounds.maxX)),
    maxY: Math.max(...bounds.map((bounds) => bounds.maxY)),
    minX: Math.min(...bounds.map((bounds) => bounds.minX)),
    minY: Math.min(...bounds.map((bounds) => bounds.minY)),
  };
};

const getTileSourceWithOffset = (tileSource, offsetX, offsetY) => {
  if (!(offsetX || offsetY)) {
    return tileSource;
  }

  const x = tileSource.x + offsetX;
  const y = tileSource.y + offsetY;

  return {
    ...tileSource,
    col: Math.floor(x / RASTER_TILE_SIZE),
    row: Math.floor(y / RASTER_TILE_SIZE),
    x,
    y,
  };
};

const getTiledBaseFrame = (node) => {
  return {
    baseHeight: node.baseHeight ?? node.height,
    baseWidth: node.baseWidth ?? node.width,
    baseX: node.baseX ?? 0,
    baseY: node.baseY ?? 0,
  };
};

const getNextTiledImageNodeState = ({
  node,
  preserveRasterPlane,
  tileSources,
}) => {
  const nextTileSourcesByRef = new Map(
    (node.tileSources || []).map((tileSource) => [tileSource.ref, tileSource])
  );

  for (const tileSource of tileSources) {
    nextTileSourcesByRef.set(tileSource.ref, tileSource);
  }

  const existingTileSources = [...nextTileSourcesByRef.values()];

  if (preserveRasterPlane) {
    return {
      ...node,
      mimeType: "image/png",
      tileSources: existingTileSources,
    };
  }

  const baseFrame = getTiledBaseFrame(node);

  const currentNode = {
    ...node,
    ...baseFrame,
  };
  const currentBounds = getRasterPlaneBounds(currentNode, existingTileSources);
  const offsetX = Math.max(0, -Math.floor(currentBounds.minX));
  const offsetY = Math.max(0, -Math.floor(currentBounds.minY));
  const nextTileSources = existingTileSources.map((tileSource) =>
    getTileSourceWithOffset(tileSource, offsetX, offsetY)
  );
  const offsetNode = {
    ...currentNode,
    baseX: baseFrame.baseX + offsetX,
    baseY: baseFrame.baseY + offsetY,
  };
  const nextBounds = getRasterPlaneBounds(offsetNode, nextTileSources);
  const width = Math.max(1, Math.ceil(nextBounds.maxX));
  const height = Math.max(1, Math.ceil(nextBounds.maxY));
  const transform =
    offsetX || offsetY
      ? getNodeTransformForPinnedWorldPoint(
          {
            ...node,
            height,
            width,
          },
          getImageNodeBounds({
            ...node,
            height,
            width,
          }),
          { x: offsetX, y: offsetY },
          getNodeWorldPoint(node, getImageNodeBounds(node), {
            x: 0,
            y: 0,
          })
        )
      : node.transform;

  return {
    ...node,
    baseHeight: offsetNode.baseHeight,
    baseWidth: offsetNode.baseWidth,
    baseX: offsetNode.baseX,
    baseY: offsetNode.baseY,
    height,
    mimeType: "image/png",
    tileSources: nextTileSources,
    transform: {
      ...node.transform,
      ...transform,
    },
    width,
    ...(Number.isFinite(node.writableX) &&
    Number.isFinite(node.writableY)
      ? {
          writableX: node.writableX + offsetX,
          writableY: node.writableY + offsetY,
        }
      : {}),
  };
};

const createFloatPixelState = ({ canvas, context }) => {
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const floatData = new Float32Array(canvas.width * canvas.height * 4);

  for (let index = 0; index < imageData.data.length; index += 1) {
    floatData[index] = imageData.data[index] / 255;
  }

  return {
    data: floatData,
    height: canvas.height,
    width: canvas.width,
  };
};

const createTileSourceFromDirtyTile = ({ commitRevision, nodeId, tile }) => {
  const imageData = tile.context.getImageData(0, 0, tile.width, tile.height);
  const alphaBounds = getAlphaBounds(imageData);

  if (!alphaBounds) {
    return null;
  }

  const width = alphaBounds.maxX - alphaBounds.minX + 1;
  const height = alphaBounds.maxY - alphaBounds.minY + 1;
  const x = tile.x + alphaBounds.minX;
  const y = tile.y + alphaBounds.minY;
  const sourceCanvas =
    width === tile.width && height === tile.height
      ? tile.canvas
      : createCanvasCopy(tile.canvas, {
          height,
          width,
          x: alphaBounds.minX,
          y: alphaBounds.minY,
        });

  if (!sourceCanvas) {
    return null;
  }

  return {
    col: tile.col,
    height,
    ref: `assets/raster/${nodeId}/tiles/${commitRevision}_${tile.col}_${tile.row}.png`,
    row: tile.row,
    src: sourceCanvas.toDataURL("image/png"),
    width,
    x,
    y,
  };
};

class BrushStrokeSession {
  constructor({ editor, node, operation, settings, startPoint, tool }) {
    this.canvasState = null;
    this.canvasOffset = { x: 0, y: 0 };
    this.canvasInputOffset = { x: 0, y: 0 };
    this.completed = false;
    this.commitStarted = false;
    this.handoffReady = Promise.resolve();
    this.resolveHandoffReady = null;
    this.dirtyBounds = null;
    this.dabGenerator = null;
    this.editor = editor;
    this.historyMark = editor.markHistoryStep(
      operation === "erase" ? "erase brush stroke" : "paint brush stroke"
    );
    this.historyResolution = "pending";
    this.invalidated = false;
    const targetsExistingRaster = editor.getNode(node.id)?.type === "image";
    this.initialSourceRect = targetsExistingRaster
      ? null
      : getArtboardClipSourceRect(editor, node);
    const initialCanvasBounds = getRasterCanvasBounds(
      node,
      this.initialSourceRect
    );
    this.canvasOffset = {
      x: initialCanvasBounds.x,
      y: initialCanvasBounds.y,
    };
    this.canvasInputOffset = { ...this.canvasOffset };
    this.preserveRasterPlane = targetsExistingRaster;
    this.usesCanvasOffset =
      targetsExistingRaster || Boolean(this.initialSourceRect);
    this.writablePolygon = getRasterWritablePolygon(editor, node);
    this.commitReady = Promise.resolve();
    this.floatPixels = null;
    this.lastPoint = null;
    this.nativeBoundaryDabGenerator = null;
    this.pathSmoother = null;
    this.nodeId = node.id;
    this.operation = operation;
    this.pointFlushFrameId = 0;
    this.pointReadIndex = 0;
    this.points = [];
    this.previewFrameId = 0;
    brushWorkingSurfaceRevision += 1;
    this.workingSurfaceId = `brush-working-${brushWorkingSurfaceRevision}`;
    this.presentationLifecycle = createRasterWorkingGroupLifecycle({
      groupId: this.workingSurfaceId,
      nodeId: this.nodeId,
      sequence: brushWorkingSurfaceRevision,
    });
    this.previewNeedsNotify = false;
    this.previewNode = getImageNodeCroppedToSourceRect(
      node,
      this.initialSourceRect
    );
    this.usesNativeStroke = shouldUseNativeStroke(settings);
    this.settings = settings;
    this.dabGenerator = this.usesNativeStroke
      ? null
      : createRasterDabGenerator(settings);
    this.pathSmoother =
      this.usesNativeStroke && settings.smoothing > 0
        ? createRasterPathSmoother(settings)
        : null;
    this.nativeBoundaryDabGenerator =
      this.usesNativeStroke && this.writablePolygon?.length
        ? createRasterDabGenerator(settings)
        : null;
    this.tileSurface = shouldUseTiledPaintSurface({
      editor,
      node,
      operation,
      sourceRect: this.initialSourceRect,
    })
      ? new RasterTileSurface({
          height: node.height,
          width: node.width,
        })
      : null;
    recordRasterDebugEvent("session.create", {
      node: getRasterDebugNodePayload(node),
      operation,
      settings: {
        hardness: settings.hardness,
        opacity: settings.opacity,
        size: settings.size,
        spacing: settings.spacing,
      },
      sourceRect: this.initialSourceRect,
      tileSurface: Boolean(this.tileSurface),
      usesNativeStroke: this.usesNativeStroke,
      workingSurfaceId: this.workingSurfaceId,
    });
    this.ready = this.tileSurface
      ? Promise.resolve().then(() => {
          incrementPerfCounter("brush.tile.session");
          this.flushPoints();

          if (this.completed) {
            this.startCommit();
          }
        })
      : loadImageToCanvas(node, this.initialSourceRect).then((canvasState) => {
          this.canvasState = canvasState;
          this.canvasOffset = {
            x: canvasState?.offset?.x ?? this.canvasOffset.x,
            y: canvasState?.offset?.y ?? this.canvasOffset.y,
          };
          this.canvasInputOffset = { ...this.canvasOffset };
          this.floatPixels =
            canvasState && !this.usesNativeStroke
              ? measurePerf("brush.stroke.createFloatPixels", () =>
                  createFloatPixelState(canvasState)
                )
              : null;
          this.flushPoints();

          if (this.completed) {
            this.startCommit();
          }
        });
    this.tool = tool;
    this.requiresFiniteInputClipping = true;

    measurePerf("brush.stroke.materializeTarget", () =>
      editor.run(() => {
        materializeBrushTarget(editor, node);
      })
    );
    recordRasterDebugEvent("target.materialized", {
      node: getRasterDebugNodePayload(editor.getNode(this.nodeId)),
      workingSurfaceId: this.workingSurfaceId,
    });
    this.addPoint(this.getInitialLocalPoint(startPoint));
  }

  getInitialLocalPoint(point) {
    if (this.tileSurface || !this.usesCanvasOffset) {
      return point;
    }

    return {
      x: point.x - this.canvasInputOffset.x,
      y: point.y - this.canvasInputOffset.y,
    };
  }

  addPoint(point, { breakBefore = false } = {}) {
    this.points.push({ breakBefore, point });
    this.flushPoints();
  }

  flushPoints({
    budgetMs = Number.POSITIVE_INFINITY,
  } = {}) {
    if (!(this.canvasState || this.tileSurface)) {
      return;
    }

    measurePerf("brush.stroke.flushPoints", () => {
      const startedAt = getNow();
      let processedCount = 0;

      while (this.pointReadIndex < this.points.length) {
        const queuedPoint = this.points[this.pointReadIndex];

        this.pointReadIndex += 1;
        if (queuedPoint.breakBefore) {
          this.finishDabGenerator();
          this.dabGenerator = this.usesNativeStroke
            ? null
            : createRasterDabGenerator(this.settings);
          this.pathSmoother =
            this.usesNativeStroke && this.settings.smoothing > 0
              ? createRasterPathSmoother(this.settings)
              : null;
          this.nativeBoundaryDabGenerator =
            this.usesNativeStroke && this.writablePolygon?.length
              ? createRasterDabGenerator(this.settings)
              : null;
          this.lastPoint = null;
        }
        this.applyPoint(queuedPoint.point);
        processedCount += 1;

        if (
          Number.isFinite(budgetMs) &&
          processedCount > 0 &&
          getNow() - startedAt >= budgetMs
        ) {
          break;
        }
      }

      if (processedCount > 0) {
        incrementPerfCounter("brush.stroke.flushPointChunk");
      }

      if (this.pointReadIndex >= this.points.length) {
        this.points = [];
        this.pointReadIndex = 0;
      } else if (this.pointReadIndex > 64) {
        this.points = this.points.slice(this.pointReadIndex);
        this.pointReadIndex = 0;
      }
    });
  }

  scheduleQueuedPointFlush() {
    if (!this.tileSurface) {
      return;
    }

    if (this.completed || this.pointFlushFrameId) {
      return;
    }

    if (!canScheduleRasterFrame()) {
      this.flushPoints();
      return;
    }

    this.pointFlushFrameId = requestRasterFrame(() => {
      this.pointFlushFrameId = 0;
      this.flushPoints({
        budgetMs: BRUSH_STROKE_POINT_FLUSH_BUDGET_MS,
      });

      if (!this.completed && this.pointReadIndex < this.points.length) {
        this.scheduleQueuedPointFlush();
      }
    });
  }

  cancelQueuedPointFlush() {
    if (!this.pointFlushFrameId) {
      this.pointFlushFrameId = 0;
      return;
    }

    cancelRasterFrame(this.pointFlushFrameId);
    this.pointFlushFrameId = 0;
  }

  applyPoint(point) {
    if (this.tileSurface) {
      this.applyTiledPoint(point);
      return;
    }

    if (this.usesNativeStroke) {
      this.applyNativeInputPoint(point);
      return;
    }

    this.applyRasterDabs(this.dabGenerator.append([point]));
  }

  applyTiledPoint(point) {
    if (this.usesNativeStroke) {
      this.applyNativeInputPoint(point);
      return;
    }

    this.applyRasterDabs(this.dabGenerator.append([point]));
  }

  applyRasterDabs(dabs) {
    if (
      this.tileSurface &&
      this.operation === "paint" &&
      dabs.length > 0 &&
      dabs.every(
        (dab) =>
          dab.flow >= 1 &&
          dab.hardness >= 1 &&
          dab.opacity >= 1 &&
          dab.roundness === 1 &&
          dab.tip.kind === "round"
      )
    ) {
      const initialTileCount = this.tileSurface.tiles.size;

      for (const dab of dabs) {
        this.expandRasterPlaneForBounds(getBrushDabRenderBounds(dab));
      }
      this.tileSurface.drawHardRoundDabs({
        color: getBrushColorRgb(dabs[0].color),
        dabs,
        writablePolygon: this.getCanvasWritablePolygon(),
      });
      for (const dab of dabs) {
        this.recordDirtyBounds(getBrushDabRenderBounds(dab));
      }
      incrementPerfCounter("brush.dab", dabs.length);
      this.publishTiledPreviewIfStructureChanged(initialTileCount);
      return;
    }

    let offsetX = 0;
    let offsetY = 0;
    const initialTileCount = this.tileSurface?.tiles.size || 0;

    for (const sourceDab of dabs) {
      let dab = {
        ...sourceDab,
        center: {
          x: sourceDab.center.x + offsetX,
          y: sourceDab.center.y + offsetY,
        },
      };

      if (!this.tileSurface) {
        this.expandRasterPlaneForBounds(getBrushDabRenderBounds(dab));
        const adjustedCenter = this.ensureCanvasIncludesDab(dab.center);
        const deltaX = adjustedCenter.x - dab.center.x;
        const deltaY = adjustedCenter.y - dab.center.y;

        if (deltaX || deltaY) {
          offsetX += deltaX;
          offsetY += deltaY;
          this.dabGenerator?.translate({ x: deltaX, y: deltaY });
          this.nativeBoundaryDabGenerator?.translate({
            x: deltaX,
            y: deltaY,
          });
          this.pathSmoother?.translate({ x: deltaX, y: deltaY });
          dab = { ...dab, center: adjustedCenter };
        }
      }

      if (this.tileSurface) {
        this.applyTiledDab(dab);
      } else {
        this.applyDab(dab);
      }
    }

    if (dabs.length > 0) {
      incrementPerfCounter("brush.dab", dabs.length);
    }

    if (this.tileSurface) {
      this.publishTiledPreviewIfStructureChanged(initialTileCount);
    }
  }

  finishDabGenerator() {
    if (this.pathSmoother) {
      this.applyNativePath(this.pathSmoother.finish());
    }

    if (
      this.nativeBoundaryDabGenerator &&
      !this.canRenderNativePathWithSurfaceClip()
    ) {
      this.applyRasterDabs(
        this.nativeBoundaryDabGenerator.finish(
          this.shouldEmitNativeBoundaryDab
        )
      );
    }

    if (this.dabGenerator) {
      this.applyRasterDabs(this.dabGenerator.finish());
    }
  }

  applyNativeInputPoint(point) {
    const smoothedPoints = measurePerf(PERF_SPANS.brushNativeStrokeSmooth, () =>
      this.pathSmoother ? this.pathSmoother.append([point]) : [point]
    );
    const canvasRebase = this.applyNativePath(smoothedPoints);

    if (!this.canRenderNativePathWithSurfaceClip()) {
      const boundaryDabs = measurePerf(
        PERF_SPANS.brushNativeBoundaryGenerate,
        () =>
          this.nativeBoundaryDabGenerator?.append(
            [
              {
                x: point.x + canvasRebase.x,
                y: point.y + canvasRebase.y,
              },
            ],
            this.shouldEmitNativeBoundaryDab
          ) || []
      );

      measurePerf(PERF_SPANS.brushNativeBoundaryApply, () =>
        this.applyRasterDabs(boundaryDabs)
      );
    }
  }

  applyNativePath(points) {
    if (points.length === 0) {
      return { x: 0, y: 0 };
    }

    const pathPoints = [...points];

    if (
      this.lastPoint &&
      (this.lastPoint.x !== pathPoints[0].x ||
        this.lastPoint.y !== pathPoints[0].y)
    ) {
      pathPoints.unshift(this.lastPoint);
    }

    const nativeRuns = measurePerf(PERF_SPANS.brushNativeStrokeClassify, () =>
      this.getNativeInteriorRuns(pathPoints)
    );
    const canvasRebase = { x: 0, y: 0 };

    for (const nativeRun of nativeRuns) {
      const adjustedRun =
        canvasRebase.x || canvasRebase.y
          ? nativeRun.map((point) => ({
              x: point.x + canvasRebase.x,
              y: point.y + canvasRebase.y,
            }))
          : nativeRun;
      const initialCanvasInputOffset = { ...this.canvasInputOffset };

      this.applyClassifiedNativePath(adjustedRun);
      canvasRebase.x +=
        initialCanvasInputOffset.x - this.canvasInputOffset.x;
      canvasRebase.y +=
        initialCanvasInputOffset.y - this.canvasInputOffset.y;
    }

    const lastPathPoint = pathPoints.at(-1);

    if (lastPathPoint) {
      this.lastPoint = {
        x: lastPathPoint.x + canvasRebase.x,
        y: lastPathPoint.y + canvasRebase.y,
      };
    }

    if (canvasRebase.x || canvasRebase.y) {
      this.nativeBoundaryDabGenerator?.translate(canvasRebase);
    }

    return canvasRebase;
  }

  getNativeInteriorRuns(pathPoints) {
    if (this.canRenderNativePathWithSurfaceClip()) {
      return [pathPoints];
    }

    const target = this.getCanvasWritableTarget();

    if (!target) {
      return [pathPoints];
    }

    const radius = getBrushDabRenderRadius(
      this.settings.size,
      this.settings.hardness
    );

    if (pathPoints.length === 1) {
      return this.isRenderBoundsInsideWritableArea(
        getNativePathBounds(pathPoints, this.settings)
      )
        ? [pathPoints]
        : [];
    }

    const runs = [];

    for (let index = 1; index < pathPoints.length; index += 1) {
      const clipped = clipRasterSegmentToTarget({
        end: pathPoints[index],
        radius: -radius,
        start: pathPoints[index - 1],
        target,
      });

      if (!clipped || pointsEqual(clipped.start, clipped.end)) {
        continue;
      }

      const currentRun = runs.at(-1);

      if (currentRun && pointsEqual(currentRun.at(-1), clipped.start)) {
        currentRun.push(clipped.end);
      } else {
        runs.push([clipped.start, clipped.end]);
      }
    }

    return runs;
  }

  applyClassifiedNativePath(pathPoints) {
    if (this.tileSurface) {
      this.applyTiledNativePath(pathPoints);
      this.lastPoint = pathPoints.at(-1);
      return;
    }

    const adjustedPoints = this.ensureCanvasIncludesNativePath(pathPoints);

    this.applyNativeCanvasPath(adjustedPoints);
    this.lastPoint = adjustedPoints.at(-1);
  }

  shouldEmitNativeBoundaryDab = (center) => {
    if (this.canRenderNativePathWithSurfaceClip()) {
      return false;
    }

    const radius = getBrushDabRenderRadius(
      this.settings.size,
      this.settings.hardness
    );

    return !this.isRenderBoundsInsideWritableArea({
      maxX: Math.ceil(center.x + radius),
      maxY: Math.ceil(center.y + radius),
      minX: Math.floor(center.x - radius),
      minY: Math.floor(center.y - radius),
    });
  };

  canRenderNativePathWithSurfaceClip() {
    const writablePolygon = this.getCanvasWritablePolygon();

    return Boolean(
      this.isWritableAreaAxisAlignedRectangle() &&
        writablePolygon?.every(
          (point) =>
            Math.abs(point.x - Math.round(point.x)) <= NATIVE_PATH_EPSILON &&
            Math.abs(point.y - Math.round(point.y)) <= NATIVE_PATH_EPSILON
        )
    );
  }

  isWritableAreaAxisAlignedRectangle() {
    const writablePolygon = this.getCanvasWritablePolygon();

    if (writablePolygon?.length !== 4) {
      return false;
    }

    const minX = Math.min(...writablePolygon.map((point) => point.x));
    const maxX = Math.max(...writablePolygon.map((point) => point.x));
    const minY = Math.min(...writablePolygon.map((point) => point.y));
    const maxY = Math.max(...writablePolygon.map((point) => point.y));
    const hasCorner = (x, y) =>
      writablePolygon.some(
        (point) =>
          Math.abs(point.x - x) <= NATIVE_PATH_EPSILON &&
          Math.abs(point.y - y) <= NATIVE_PATH_EPSILON
      );

    return (
      writablePolygon.every(
        (point) =>
          (Math.abs(point.x - minX) <= NATIVE_PATH_EPSILON ||
            Math.abs(point.x - maxX) <= NATIVE_PATH_EPSILON) &&
          (Math.abs(point.y - minY) <= NATIVE_PATH_EPSILON ||
            Math.abs(point.y - maxY) <= NATIVE_PATH_EPSILON)
      ) &&
      hasCorner(minX, minY) &&
      hasCorner(maxX, minY) &&
      hasCorner(maxX, maxY) &&
      hasCorner(minX, maxY)
    );
  }

  getCanvasWritableTarget() {
    const writablePolygon = this.getCanvasWritablePolygon();

    if (!writablePolygon?.length) {
      return null;
    }

    const minX = Math.min(...writablePolygon.map((point) => point.x));
    const minY = Math.min(...writablePolygon.map((point) => point.y));
    const maxX = Math.max(...writablePolygon.map((point) => point.x));
    const maxY = Math.max(...writablePolygon.map((point) => point.y));
    const bounds = {
      height: maxY - minY,
      width: maxX - minX,
      x: minX,
      y: minY,
    };

    return {
      bounds,
      pixelSize: { height: 1, width: 1 },
      writableBounds: bounds,
      writablePolygon,
    };
  }

  isRenderBoundsInsideWritableArea(bounds) {
    return [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.maxY },
    ].every((point) => this.isCanvasPointWritable(point));
  }

  applyNativeCanvasPath(points) {
    const { canvas, context } = this.canvasState;
    const pathBounds = getNativePathBounds(points, this.settings);
    const bounds = {
      maxX: Math.min(canvas.width, pathBounds.maxX),
      maxY: Math.min(canvas.height, pathBounds.maxY),
      minX: Math.max(0, pathBounds.minX),
      minY: Math.max(0, pathBounds.minY),
    };

    if (bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY) {
      return;
    }

    measurePerf("brush.nativeStroke.draw", () => {
      const color = getBrushColorRgb(this.settings.color);

      context.save();
      this.clipContextToWritablePolygon(context);
      context.globalAlpha = 1;
      context.globalCompositeOperation =
        this.operation === "erase" ? "destination-out" : "source-over";
      context.fillStyle =
        this.operation === "erase"
          ? "rgba(0, 0, 0, 1)"
          : `rgb(${color.r}, ${color.g}, ${color.b})`;
      context.strokeStyle = context.fillStyle;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = this.settings.size;

      if (points.length === 1) {
        const point = points[0];

        context.beginPath();
        context.arc(
          point.x,
          point.y,
          this.settings.size / 2,
          0,
          Math.PI * 2
        );
        context.fill();
      } else {
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        for (const point of points.slice(1)) {
          context.lineTo(point.x, point.y);
        }
        context.stroke();
      }

      context.restore();
    });
    this.floatPixels = null;

    incrementPerfCounter(
      "brush.nativeStroke.segment",
      Math.max(1, points.length - 1)
    );
    this.recordDirtyBounds(bounds);
    this.scheduleLivePreview();
  }

  applyTiledNativePath(points) {
    if (points.length === 0) {
      return;
    }

    const initialTileCount = this.tileSurface.tiles.size;
    const renderRadius = getBrushDabRenderRadius(
      this.settings.size,
      this.settings.hardness
    );
    const bounds = {
      maxX: Math.ceil(
        Math.max(...points.map((point) => point.x)) + renderRadius
      ),
      maxY: Math.ceil(
        Math.max(...points.map((point) => point.y)) + renderRadius
      ),
      minX: Math.floor(
        Math.min(...points.map((point) => point.x)) - renderRadius
      ),
      minY: Math.floor(
        Math.min(...points.map((point) => point.y)) - renderRadius
      ),
    };

    this.expandRasterPlaneForBounds(bounds);
    this.tileSurface.drawNativePath({
      color: getBrushColorRgb(this.settings.color),
      lineWidth: this.settings.size,
      points,
      writablePolygon: this.getCanvasWritablePolygon(),
    });

    incrementPerfCounter(
      "brush.nativeStroke.segment",
      Math.max(1, points.length - 1)
    );
    this.recordDirtyBounds(bounds);
    this.publishTiledPreviewIfStructureChanged(initialTileCount);
  }

  applyTiledDab(dab) {
    const bounds = getBrushDabRenderBounds(dab);

    this.expandRasterPlaneForBounds(bounds);
    this.tileSurface.drawPaintDab({
      bounds,
      color: getBrushColorRgb(dab.color),
      getCoverage: (x, y) => {
        if (!this.isCanvasPointWritable({ x, y })) {
          return 0;
        }

        return getRasterDabCoverageAtPoint(dab, { x, y });
      },
      opacity: dab.opacity * dab.flow,
      point: dab.center,
    });

    this.recordDirtyBounds(bounds);
  }

  applyDab(dab) {
    const { canvas, context } = this.canvasState;

    if (!this.floatPixels) {
      this.floatPixels = createFloatPixelState(this.canvasState);
    }

    const bounds = getBrushDabRenderBounds(dab);
    const minX = Math.max(0, bounds.minX);
    const minY = Math.max(0, bounds.minY);
    const maxX = Math.min(canvas.width - 1, bounds.maxX);
    const maxY = Math.min(canvas.height - 1, bounds.maxY);

    if (maxX < minX || maxY < minY) {
      return;
    }

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const imageData = context.getImageData(minX, minY, width, height);
    const data = imageData.data;
    const color = getBrushColorRgb(dab.color);

    for (let localY = 0; localY < height; localY += 1) {
      for (let localX = 0; localX < width; localX += 1) {
        const x = minX + localX;
        const y = minY + localY;

        if (!this.isCanvasPointWritable({ x: x + 0.5, y: y + 0.5 })) {
          continue;
        }

        const falloff = getRasterDabCoverageAtPoint(dab, {
          x: x + 0.5,
          y: y + 0.5,
        });

        if (falloff <= 0) {
          continue;
        }

        const alpha = clamp(falloff * dab.opacity * dab.flow, 0, 1);
        const offset = (localY * width + localX) * 4;
        const floatOffset = (y * canvas.width + x) * 4;

        if (this.operation === "erase") {
          const outputAlpha = getErasedAlpha(
            this.floatPixels.data[floatOffset + 3],
            alpha
          );

          this.floatPixels.data[floatOffset + 3] = outputAlpha;
          data[offset + 3] = Math.round(outputAlpha * 255);

          if (data[offset + 3] === 0) {
            this.floatPixels.data[floatOffset] = 0;
            this.floatPixels.data[floatOffset + 1] = 0;
            this.floatPixels.data[floatOffset + 2] = 0;
            data[offset] = 0;
            data[offset + 1] = 0;
            data[offset + 2] = 0;
          }

          continue;
        }

        const sourceAlpha = alpha;
        const targetAlpha = this.floatPixels.data[floatOffset + 3];
        const outputAlpha = getPaintedAlpha(targetAlpha, sourceAlpha);

        if (outputAlpha <= 0) {
          this.floatPixels.data[floatOffset] = 0;
          this.floatPixels.data[floatOffset + 1] = 0;
          this.floatPixels.data[floatOffset + 2] = 0;
          this.floatPixels.data[floatOffset + 3] = 0;
          data[offset] = 0;
          data[offset + 1] = 0;
          data[offset + 2] = 0;
          data[offset + 3] = 0;
          continue;
        }

        const outputRed =
          ((color.r / 255) * sourceAlpha +
            this.floatPixels.data[floatOffset] *
              targetAlpha *
              (1 - sourceAlpha)) /
          outputAlpha;
        const outputGreen =
          ((color.g / 255) * sourceAlpha +
            this.floatPixels.data[floatOffset + 1] *
              targetAlpha *
              (1 - sourceAlpha)) /
          outputAlpha;
        const outputBlue =
          ((color.b / 255) * sourceAlpha +
            this.floatPixels.data[floatOffset + 2] *
              targetAlpha *
              (1 - sourceAlpha)) /
          outputAlpha;

        this.floatPixels.data[floatOffset] = outputRed;
        this.floatPixels.data[floatOffset + 1] = outputGreen;
        this.floatPixels.data[floatOffset + 2] = outputBlue;
        this.floatPixels.data[floatOffset + 3] = outputAlpha;

        data[offset] = Math.round(outputRed * 255);
        data[offset + 1] = Math.round(outputGreen * 255);
        data[offset + 2] = Math.round(outputBlue * 255);
        data[offset + 3] = Math.round(outputAlpha * 255);
      }
    }

    context.putImageData(imageData, minX, minY);
    this.recordDirtyBounds({ maxX, maxY, minX, minY });
    this.scheduleLivePreview();
  }

  getCanvasWritablePolygon() {
    const offset = this.tileSurface ? { x: 0, y: 0 } : this.canvasOffset;

    return this.writablePolygon?.map((point) => ({
      x: point.x - offset.x,
      y: point.y - offset.y,
    }));
  }

  isCanvasPointWritable(point) {
    const polygon = this.getCanvasWritablePolygon();

    if (!polygon) {
      return true;
    }

    let inside = false;

    for (
      let index = 0, previousIndex = polygon.length - 1;
      index < polygon.length;
      previousIndex = index, index += 1
    ) {
      const current = polygon[index];
      const previous = polygon[previousIndex];
      const crosses =
        current.y > point.y !== previous.y > point.y &&
        point.x <
          ((previous.x - current.x) * (point.y - current.y)) /
            (previous.y - current.y) +
            current.x;

      if (crosses) {
        inside = !inside;
      }
    }

    return inside;
  }

  clipContextToWritablePolygon(context) {
    const polygon = this.getCanvasWritablePolygon();

    if (!polygon?.length) {
      return;
    }

    context.beginPath();
    context.moveTo(polygon[0].x, polygon[0].y);
    for (const point of polygon.slice(1)) {
      context.lineTo(point.x, point.y);
    }
    context.closePath();
    context.clip();
  }

  expandFloatPixels({ bottom, left, right, top }) {
    if (!this.floatPixels) {
      return;
    }

    const nextWidth = this.floatPixels.width + left + right;
    const nextHeight = this.floatPixels.height + top + bottom;
    const nextData = new Float32Array(nextWidth * nextHeight * 4);

    for (let y = 0; y < this.floatPixels.height; y += 1) {
      for (let x = 0; x < this.floatPixels.width; x += 1) {
        const sourceOffset = (y * this.floatPixels.width + x) * 4;
        const targetOffset = ((y + top) * nextWidth + x + left) * 4;

        nextData[targetOffset] = this.floatPixels.data[sourceOffset];
        nextData[targetOffset + 1] = this.floatPixels.data[sourceOffset + 1];
        nextData[targetOffset + 2] = this.floatPixels.data[sourceOffset + 2];
        nextData[targetOffset + 3] = this.floatPixels.data[sourceOffset + 3];
      }
    }

    this.floatPixels = {
      data: nextData,
      height: nextHeight,
      width: nextWidth,
    };
  }

  ensureCanvasIncludesNativePath(points) {
    const minimumPoint = {
      x: Math.min(...points.map((point) => point.x)),
      y: Math.min(...points.map((point) => point.y)),
    };
    const adjustedMinimumPoint = this.ensureCanvasIncludesDab(minimumPoint);
    const delta = {
      x: adjustedMinimumPoint.x - minimumPoint.x,
      y: adjustedMinimumPoint.y - minimumPoint.y,
    };
    const adjustedPoints =
      delta.x || delta.y
        ? points.map((point) => ({
            x: point.x + delta.x,
            y: point.y + delta.y,
          }))
        : points;

    if (delta.x || delta.y) {
      this.pathSmoother?.translate(delta);
    }

    this.ensureCanvasIncludesDab({
      x: Math.max(...adjustedPoints.map((point) => point.x)),
      y: Math.max(...adjustedPoints.map((point) => point.y)),
    });

    return adjustedPoints;
  }

  ensureCanvasIncludesDab(point) {
    if (this.operation === "erase") {
      return point;
    }

    const { canvas } = this.canvasState;
    const writableBounds = getRasterWritableBounds(
      this.editor,
      this.previewNode || this.editor.getNode(this.nodeId)
    );
    const canvasWritableBounds = this.getCanvasWritableTarget()?.bounds;
    const radius = getBrushDabRenderRadius(
      this.settings.size,
      this.settings.hardness
    );
    const requiredLeft = Math.max(0, Math.ceil(radius - point.x));
    const requiredTop = Math.max(0, Math.ceil(radius - point.y));
    const requiredRight = Math.max(
      0,
      Math.ceil(point.x + radius - canvas.width + 1)
    );
    const requiredBottom = Math.max(
      0,
      Math.ceil(point.y + radius - canvas.height + 1)
    );

    if (!(requiredLeft || requiredTop || requiredRight || requiredBottom)) {
      return point;
    }

    const expansionPadding = getBrushLayerExpansionPadding(this.settings);
    const writableMinX =
      canvasWritableBounds?.x ?? writableBounds.x - this.canvasOffset.x;
    const writableMinY =
      canvasWritableBounds?.y ?? writableBounds.y - this.canvasOffset.y;
    const writableMaxX =
      writableMinX + (canvasWritableBounds?.width ?? writableBounds.width);
    const writableMaxY =
      writableMinY + (canvasWritableBounds?.height ?? writableBounds.height);
    const maxLeft = Math.max(0, Math.ceil(-writableMinX));
    const maxTop = Math.max(0, Math.ceil(-writableMinY));
    const maxRight = Math.max(0, Math.ceil(writableMaxX - canvas.width));
    const maxBottom = Math.max(0, Math.ceil(writableMaxY - canvas.height));
    const left = requiredLeft
      ? Math.min(requiredLeft + expansionPadding, maxLeft)
      : 0;
    const top = requiredTop
      ? Math.min(requiredTop + expansionPadding, maxTop)
      : 0;
    const right = requiredRight
      ? Math.min(requiredRight + expansionPadding, maxRight)
      : 0;
    const bottom = requiredBottom
      ? Math.min(requiredBottom + expansionPadding, maxBottom)
      : 0;

    if (!(left || top || right || bottom)) {
      return point;
    }

    const didExpand = measurePerf("brush.canvas.expand", () => {
      const nextCanvas = createCanvas(
        canvas.width + left + right,
        canvas.height + top + bottom
      );
      const nextContext = nextCanvas?.getContext("2d", {
        willReadFrequently: true,
      });

      if (!(nextCanvas && nextContext)) {
        return false;
      }

      incrementPerfCounter("brush.canvas.expand");
      nextContext.drawImage(canvas, left, top);
      this.canvasState = {
        canvas: nextCanvas,
        context: nextContext,
      };
      this.canvasInputOffset = {
        x: this.canvasInputOffset.x - left,
        y: this.canvasInputOffset.y - top,
      };
      if (this.preserveRasterPlane) {
        this.writablePolygon = this.writablePolygon?.map((polygonPoint) => ({
          x: polygonPoint.x + left,
          y: polygonPoint.y + top,
        }));
      } else {
        this.canvasOffset = {
          x: this.canvasOffset.x - left,
          y: this.canvasOffset.y - top,
        };
      }
      this.expandFloatPixels({ bottom, left, right, top });

      if (this.lastPoint) {
        this.lastPoint = {
          x: this.lastPoint.x + left,
          y: this.lastPoint.y + top,
        };
      }

      this.points = this.points.map((queuedPoint) => ({
        ...queuedPoint,
        point: {
          x: queuedPoint.point.x + left,
          y: queuedPoint.point.y + top,
        },
      }));

      if (this.dirtyBounds) {
        this.dirtyBounds = {
          maxX: this.dirtyBounds.maxX + left,
          maxY: this.dirtyBounds.maxY + top,
          minX: this.dirtyBounds.minX + left,
          minY: this.dirtyBounds.minY + top,
        };
      }

      this.expandNodeBounds({ bottom, left, top, right });
      return true;
    });

    if (!didExpand) {
      return point;
    }

    return {
      x: point.x + left,
      y: point.y + top,
    };
  }

  expandNodeBounds({ bottom, left, right, top }) {
    const currentNode = this.previewNode || this.editor.getNode(this.nodeId);

    if (currentNode?.type !== "image") {
      return;
    }

    const currentBounds = getImageNodeBounds(currentNode);
    const pinnedWorldPoint = getNodeWorldPoint(currentNode, currentBounds, {
      x: 0,
      y: 0,
    });
    const nextNode = {
      ...currentNode,
      height: currentNode.height + top + bottom,
      width: currentNode.width + left + right,
    };
    const nextTransform = getNodeTransformForPinnedWorldPoint(
      nextNode,
      getImageNodeBounds(nextNode),
      { x: left, y: top },
      pinnedWorldPoint
    );

    this.previewNode = {
      ...currentNode,
      height: nextNode.height,
      transform: {
        ...currentNode.transform,
        ...nextTransform,
      },
      width: nextNode.width,
      ...(Number.isFinite(currentNode.writableX) &&
      Number.isFinite(currentNode.writableY)
        ? {
            writableX: currentNode.writableX + left,
            writableY: currentNode.writableY + top,
          }
        : {}),
    };
  }

  recordDirtyBounds(bounds) {
    this.dirtyBounds = this.dirtyBounds
      ? {
          maxX: Math.max(this.dirtyBounds.maxX, bounds.maxX),
          maxY: Math.max(this.dirtyBounds.maxY, bounds.maxY),
          minX: Math.min(this.dirtyBounds.minX, bounds.minX),
          minY: Math.min(this.dirtyBounds.minY, bounds.minY),
        }
      : bounds;
  }

  expandRasterPlaneForBounds(bounds) {
    if (!this.preserveRasterPlane || this.operation === "erase") {
      return;
    }

    const node = this.editor.getNode(this.nodeId);

    if (node?.type !== "image") {
      return;
    }

    const offset = this.tileSurface ? { x: 0, y: 0 } : this.canvasOffset;
    const writableBounds = getRasterWritableBounds(this.editor, node);
    const paintedBounds = {
      maxX: Math.min(bounds.maxX + offset.x, writableBounds.x + writableBounds.width),
      maxY: Math.min(bounds.maxY + offset.y, writableBounds.y + writableBounds.height),
      minX: Math.max(bounds.minX + offset.x, writableBounds.x),
      minY: Math.max(bounds.minY + offset.y, writableBounds.y),
    };

    if (
      paintedBounds.minX < paintedBounds.maxX &&
      paintedBounds.minY < paintedBounds.maxY &&
      (paintedBounds.minX < 0 ||
        paintedBounds.minY < 0 ||
        paintedBounds.maxX > node.width ||
        paintedBounds.maxY > node.height)
    ) {
      this.preserveRasterPlane = false;
      this.editor.notifyInteractionPreviewChanged();
    }
  }

  update({ point }) {
    this.addPoint(this.getLocalPoint(point));
  }

  restart({ point }) {
    this.addPoint(this.getLocalPoint(point), { breakBefore: true });
  }

  complete({ point }) {
    this.addPoint(this.getLocalPoint(point));
    return this.completeCurrent();
  }

  completeCurrent() {
    recordRasterDebugEvent("session.complete.start", {
      nodeId: this.nodeId,
      pendingPointCount: this.points.length,
      tileSurface: Boolean(this.tileSurface),
      workingSurfaceId: this.workingSurfaceId,
    });
    this.completed = true;
    this.presentationLifecycle = markRasterWorkingGroupCommitting(
      this.presentationLifecycle
    );
    this.editor.notifyInteractionPreviewChanged();
    this.cancelQueuedPointFlush();

    if (!this.commitStarted) {
      this.handoffReady = new Promise((resolve) => {
        this.resolveHandoffReady = resolve;
      });
    }

    if (this.canvasState || this.tileSurface) {
      this.flushPoints();
      this.finishDabGenerator();
      recordRasterDebugEvent("session.complete.flushed", {
        dirtyBounds: this.dirtyBounds,
        dirtyTileCount: this.tileSurface?.getDirtyTiles().length || 0,
        nodeId: this.nodeId,
        workingSurfaceId: this.workingSurfaceId,
      });
      this.startCommit();
    }

    return this.commitReady;
  }

  cancel() {
    this.cancelQueuedPointFlush();
    this.cancelLivePreview();
    this.rollbackHistory();
    this.invalidateWorkingPresentation();
  }

  startCommit() {
    if (this.commitStarted) {
      return this.commitReady;
    }

    try {
      this.commitReady = Promise.resolve(this.commit());
    } catch (error) {
      this.commitReady = Promise.reject(error);
    }

    this.commitReady = this.commitReady.catch((error) => {
      this.rollbackHistory();
      this.invalidateWorkingPresentation();
      throw error;
    });
    return this.commitReady;
  }

  commit() {
    if (!(this.completed && !this.commitStarted)) {
      return this.commitReady;
    }

    this.commitStarted = true;
    this.cancelLivePreview();
    recordRasterDebugEvent("commit.start", {
      dirtyBounds: this.dirtyBounds,
      nodeId: this.nodeId,
      tileSurface: Boolean(this.tileSurface),
      workingSurfaceId: this.workingSurfaceId,
    });

    if (!this.dirtyBounds) {
      recordRasterDebugEvent("commit.noDirtyBounds", {
        nodeId: this.nodeId,
        workingSurfaceId: this.workingSurfaceId,
      });
      this.rollbackHistory();
      this.invalidateWorkingPresentation();
      return Promise.resolve();
    }

    if (this.tileSurface) {
      return this.commitTileSurface();
    }

    const committedCanvas = measurePerf("brush.commit.prepareCanvas", () =>
      this.preserveRasterPlane
        ? this.getPreservedPlaneCanvas()
        : this.getTrimmedCanvas()
    );
    const src = measurePerf("brush.commit.encode", () =>
      committedCanvas.canvas.toDataURL("image/png")
    );
    brushPresentationCommitRevision += 1;
    const replacement = {
      commitId: `raster-commit-${brushPresentationCommitRevision}`,
      kind: "canvas",
      resourceIds: [src],
    };
    let committedNode = null;

    this.awaitWorkingPresentationReplacement(replacement);
    measurePerf("brush.commit.updateNode", () =>
      this.editor.run(() => {
        this.editor.getState().updateNodeById(this.nodeId, (node) => {
          if (node.type !== "image") {
            return node;
          }

          committedNode = {
            ...node,
            baseHeight: committedCanvas.height,
            baseWidth: committedCanvas.width,
            baseX: committedCanvas.baseX ?? 0,
            baseY: committedCanvas.baseY ?? 0,
            height: committedCanvas.visibleHeight ?? committedCanvas.height,
            mimeType: "image/png",
            src,
            transform: {
              ...node.transform,
              ...committedCanvas.transform,
            },
            width: committedCanvas.visibleWidth ?? committedCanvas.width,
            ...(this.previewNode &&
            Number.isFinite(this.previewNode.writableX) &&
            Number.isFinite(this.previewNode.writableY)
              ? {
                  writableX: this.previewNode.writableX,
                  writableY: this.previewNode.writableY,
                }
              : {}),
          };
          return committedNode;
        });
      })
    );

    if (!committedNode) {
      throw new Error("Raster canvas commit target is unavailable");
    }

    this.commitHistory();
    recordRasterDebugEvent("commit.canvas.finish", {
      node: getRasterDebugNodePayload(this.editor.getNode(this.nodeId)),
      workingSurfaceId: this.workingSurfaceId,
    });
    return Promise.resolve();
  }

  commitTileSurface() {
    const dirtyTiles = this.tileSurface.getDirtyTiles();
    recordRasterDebugEvent("tileCommit.start", {
      dirtyTileCount: dirtyTiles.length,
      nodeId: this.nodeId,
      workingSurfaceId: this.workingSurfaceId,
    });

    if (dirtyTiles.length === 0) {
      recordRasterDebugEvent("tileCommit.noDirtyTiles", {
        nodeId: this.nodeId,
        workingSurfaceId: this.workingSurfaceId,
      });
      this.rollbackHistory();
      this.invalidateWorkingPresentation();
      return Promise.resolve();
    }

    brushTileCommitRevision += 1;
    const commitRevision = brushTileCommitRevision;
    const shouldCommitAsync =
      canScheduleRasterFrame() &&
      dirtyTiles.length > BRUSH_TILE_ASYNC_COMMIT_THRESHOLD;
    recordRasterDebugEvent("tileCommit.mode", {
      commitRevision,
      dirtyTileCount: dirtyTiles.length,
      nodeId: this.nodeId,
      shouldCommitAsync,
      workingSurfaceId: this.workingSurfaceId,
    });

    if (shouldCommitAsync) {
      return this.commitTileSurfaceAsync({ commitRevision, dirtyTiles });
    }

    const tileSources = measurePerf("brush.tile.commit.encode", () =>
      dirtyTiles.flatMap((tile) => {
        const tileSource = createTileSourceFromDirtyTile({
          commitRevision,
          nodeId: this.nodeId,
          workingSurfaceId: this.workingSurfaceId,
          tile,
        });

        return tileSource ? [tileSource] : [];
      })
    );

    this.finishTileSurfaceCommit(tileSources);
    return Promise.resolve();
  }

  commitTileSurfaceAsync({ commitRevision, dirtyTiles }) {
    return new Promise((resolve, reject) => {
      const tileSources: NonNullable<
        ReturnType<typeof createTileSourceFromDirtyTile>
      >[] = [];
      let tileIndex = 0;
      const encodeChunk = () => {
        try {
          measurePerf("brush.tile.commit.encode.chunk", () => {
            const startedAt = getNow();

            while (tileIndex < dirtyTiles.length) {
              const tileSource = createTileSourceFromDirtyTile({
                commitRevision,
                nodeId: this.nodeId,
                tile: dirtyTiles[tileIndex],
              });

              tileIndex += 1;

              if (tileSource) {
                tileSources.push(tileSource);
              }

              if (getNow() - startedAt >= BRUSH_TILE_COMMIT_BUDGET_MS) {
                break;
              }
            }
          });
          incrementPerfCounter("brush.tile.commit.encodeChunk");

          if (tileIndex < dirtyTiles.length) {
            requestRasterFrame(encodeChunk);
            return;
          }

          recordRasterDebugEvent("tileCommit.asyncEncoded", {
            commitRevision,
            encodedTileCount: tileSources.length,
            nodeId: this.nodeId,
            workingSurfaceId: this.workingSurfaceId,
          });
          this.finishTileSurfaceCommit(tileSources);
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      requestRasterFrame(encodeChunk);
    });
  }

  finishTileSurfaceCommit(tileSources) {
    if (this.invalidated || !this.editor.getNode(this.nodeId)) {
      return;
    }

    if (tileSources.length === 0) {
      recordRasterDebugEvent("tileCommit.emptyEncodedTiles", {
        nodeId: this.nodeId,
        workingSurfaceId: this.workingSurfaceId,
      });
      this.rollbackHistory();
      this.invalidateWorkingPresentation();
      return;
    }

    let committedNode = null;

    const commitTileRefs = tileSources.map((tileSource) => tileSource.ref);
    brushPresentationCommitRevision += 1;
    this.awaitWorkingPresentationReplacement({
      commitId: `raster-commit-${brushPresentationCommitRevision}`,
      kind: "tiles",
      resourceIds: commitTileRefs,
    });

    measurePerf("brush.tile.commit.updateNode", () =>
      this.editor.run(() => {
        this.editor.getState().updateNodeById(this.nodeId, (node) => {
          if (node.type !== "image") {
            return node;
          }

          committedNode = getNextTiledImageNodeState({
            node,
            preserveRasterPlane: this.preserveRasterPlane,
            tileSources,
          });
          return committedNode;
        });
      })
    );

    if (!committedNode) {
      throw new Error("Raster tile commit target is unavailable");
    }

    this.commitHistory();
    recordRasterDebugEvent("tileCommit.finish", {
      committedNode: getRasterDebugNodePayload(committedNode),
      encodedTileCount: tileSources.length,
      nodeId: this.nodeId,
      workingSurfaceId: this.workingSurfaceId,
    });
  }

  scheduleLivePreview({ notify = true } = {}) {
    if (this.completed || this.previewFrameId) {
      this.previewNeedsNotify = this.previewNeedsNotify || notify;
      return;
    }

    if (!canScheduleRasterFrame()) {
      if (notify) {
        this.editor.notifyInteractionPreviewChanged();
      }
      return;
    }

    this.previewNeedsNotify = this.previewNeedsNotify || notify;
    this.previewFrameId = requestRasterFrame(() => {
      const shouldNotify = this.previewNeedsNotify;

      this.previewFrameId = 0;
      this.previewNeedsNotify = false;
      if (shouldNotify) {
        this.editor.notifyInteractionPreviewChanged();
      }
    });
  }

  publishTiledPreviewIfStructureChanged(initialTileCount) {
    if (this.tileSurface.tiles.size > initialTileCount) {
      this.editor.notifyInteractionPreviewChanged();
    }
  }

  cancelLivePreview() {
    if (!this.previewFrameId) {
      this.previewFrameId = 0;
      return;
    }

    cancelRasterFrame(this.previewFrameId);
    this.previewFrameId = 0;
  }

  resolveCommitHandoff(status = "presented") {
    const resolve = this.resolveHandoffReady;

    this.resolveHandoffReady = null;
    resolve?.({ status });
  }

  awaitWorkingPresentationReplacement(replacement) {
    if (!this.presentationLifecycle) {
      return;
    }

    this.presentationLifecycle = markRasterWorkingGroupAwaitingReplacement(
      this.presentationLifecycle,
      replacement
    );
    recordRasterDebugEvent("handoff.wait", {
      commitId: replacement.commitId,
      nodeId: this.nodeId,
      replacementKind: replacement.kind,
      resourceCount: replacement.resourceIds.length,
      workingSurfaceId: this.workingSurfaceId,
    });
    this.editor.notifyInteractionPreviewChanged();
  }

  acknowledgeWorkingPresentation(acknowledgement) {
    const nextLifecycle = acknowledgeRasterWorkingGroup(
      this.presentationLifecycle,
      acknowledgement
    );

    if (nextLifecycle === this.presentationLifecycle) {
      return false;
    }

    recordRasterDebugEvent("handoff.acknowledge", {
      commitId: acknowledgement.commitId,
      nodeId: this.nodeId,
      workingSurfaceId: this.workingSurfaceId,
    });
    this.presentationLifecycle = nextLifecycle;
    this.clearWorkingPresentation();
    return true;
  }

  failWorkingPresentation(failure) {
    if (
      acknowledgeRasterWorkingGroup(this.presentationLifecycle, failure) ===
      this.presentationLifecycle
    ) {
      return false;
    }

    recordRasterDebugEvent("handoff.fail", {
      commitId: failure.commitId,
      nodeId: this.nodeId,
      reason: failure.reason,
      workingSurfaceId: this.workingSurfaceId,
    });
    this.presentationLifecycle = markRasterWorkingGroupPresentationFailed(
      this.presentationLifecycle
    );
    this.resolveCommitHandoff("failed");
    this.editor.notifyInteractionPreviewChanged();
    return true;
  }

  invalidateWorkingPresentation() {
    this.invalidated = true;
    this.presentationLifecycle = invalidateRasterWorkingGroup(
      this.presentationLifecycle
    );
    this.clearWorkingPresentation();
  }

  resolveHistoryForInvalidation() {
    this.commitHistory();
  }

  commitHistory() {
    if (this.historyResolution !== "pending") {
      return false;
    }

    this.historyResolution = "committed";
    return this.editor.commitHistoryStep(this.historyMark);
  }

  rollbackHistory() {
    if (this.historyResolution !== "pending") {
      return false;
    }

    this.historyResolution = "reverted";
    return this.editor.revertToMark(this.historyMark);
  }

  clearWorkingPresentation() {
    recordRasterDebugEvent("handoff.clear", {
      nodeId: this.nodeId,
      workingSurfaceId: this.workingSurfaceId,
    });
    this.completed = false;
    this.resolveCommitHandoff();
    this.tool.clearPendingPreview(this);
    this.tool.clearActiveSession(this);
  }

  hasPendingWorkingSurface() {
    return this.completed && Boolean(this.getWorkingGroup());
  }

  getCommitReady() {
    return this.commitReady;
  }

  getHandoffReady() {
    return this.handoffReady;
  }

  getFollowupReady() {
    const node = this.editor.getNode(this.nodeId);

    return getNodeArtboardClipBounds(this.editor, node)
      ? this.commitReady
      : this.handoffReady;
  }

  getWorkingGroup() {
    const durableNode = this.editor.getNode(this.nodeId);
    const node = this.previewNode || durableNode;

    if (!(durableNode?.type === "image" && node && this.presentationLifecycle)) {
      return null;
    }
    const writableBounds = getRasterWritableBounds(
      this.editor,
      durableNode || node
    );
    const presentationBounds = writableBounds
      ? {
          height: writableBounds.height,
          maxX: writableBounds.x + writableBounds.width,
          maxY: writableBounds.y + writableBounds.height,
          minX: writableBounds.x,
          minY: writableBounds.y,
          width: writableBounds.width,
        }
      : getImageNodeBounds(node);

    if (this.tileSurface) {
      const workingSurface = this.tileSurface.createDirtyWorkingTiles();

      if (!workingSurface?.tiles.length) {
        return null;
      }

      return {
        ...this.presentationLifecycle,
        allowOverflow: !this.preserveRasterPlane,
        bounds: presentationBounds,
        content: {
          kind: "tiles",
          tiles: workingSurface.tiles,
        },
        matrix:
          getRasterWorkingToNodeMatrix(durableNode, {
            height: node.height,
            transform: node.transform || {},
            width: node.width,
          }) || { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        replacesNode: false,
      };
    }

    if (!this.canvasState) {
      return null;
    }

    return {
      ...this.presentationLifecycle,
      allowOverflow: !this.preserveRasterPlane,
      bounds: presentationBounds,
      content: {
        canvas: this.canvasState.canvas,
        height: this.canvasState.canvas.height,
        kind: "canvas",
        width: this.canvasState.canvas.width,
        x: this.preserveRasterPlane ? this.canvasOffset.x : 0,
        y: this.preserveRasterPlane ? this.canvasOffset.y : 0,
      },
      matrix:
        getRasterWorkingToNodeMatrix(durableNode, {
          height: this.canvasState.canvas.height,
          transform: this.previewNode?.transform || node.transform || {},
          width: this.canvasState.canvas.width,
        }) || { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      replacesNode: true,
    };
  }

  getWorkingNodeId() {
    return this.nodeId;
  }

  getTrimmedCanvas() {
    const { canvas, context } = this.canvasState;
    const node = this.previewNode || this.editor.getNode(this.nodeId);
    const clippedCanvas = this.getArtboardClippedCanvas({
      canvas,
      context,
      node,
    });
    const imageData = clippedCanvas.context.getImageData(
      0,
      0,
      clippedCanvas.canvas.width,
      clippedCanvas.canvas.height
    );
    const alphaBounds = getAlphaBounds(imageData);

    if (!(node?.type === "image" && alphaBounds)) {
      return {
        canvas: clippedCanvas.canvas,
        height: clippedCanvas.canvas.height,
        transform: clippedCanvas.transform,
        width: clippedCanvas.canvas.width,
      };
    }

    const width = alphaBounds.maxX - alphaBounds.minX + 1;
    const height = alphaBounds.maxY - alphaBounds.minY + 1;

    if (
      alphaBounds.minX === 0 &&
      alphaBounds.minY === 0 &&
      width === clippedCanvas.canvas.width &&
      height === clippedCanvas.canvas.height
    ) {
      return {
        canvas: clippedCanvas.canvas,
        height: clippedCanvas.canvas.height,
        transform: clippedCanvas.transform,
        width: clippedCanvas.canvas.width,
      };
    }

    const nextCanvas = createCanvas(width, height);
    const nextContext = nextCanvas?.getContext("2d", {
      willReadFrequently: true,
    });

    if (!(nextCanvas && nextContext)) {
      return {
        canvas: clippedCanvas.canvas,
        height: clippedCanvas.canvas.height,
        transform: clippedCanvas.transform,
        width: clippedCanvas.canvas.width,
      };
    }

    nextContext.drawImage(
      clippedCanvas.canvas,
      alphaBounds.minX,
      alphaBounds.minY,
      width,
      height,
      0,
      0,
      width,
      height
    );

    const pinnedWorldPoint = getNodeWorldPoint(
      clippedCanvas.node,
      getImageNodeBounds(clippedCanvas.node),
      {
        x: alphaBounds.minX,
        y: alphaBounds.minY,
      }
    );
    const nextNode = {
      ...clippedCanvas.node,
      height,
      width,
    };

    return {
      canvas: nextCanvas,
      height,
      transform: getNodeTransformForPinnedWorldPoint(
        nextNode,
        getImageNodeBounds(nextNode),
        { x: 0, y: 0 },
        pinnedWorldPoint
      ),
      width,
    };
  }

  getPreservedPlaneCanvas() {
    const node = this.editor.getNode(this.nodeId);

    return {
      baseX: this.canvasOffset.x,
      baseY: this.canvasOffset.y,
      canvas: this.canvasState.canvas,
      height: this.canvasState.canvas.height,
      transform: this.previewNode?.transform || node?.transform || {},
      visibleHeight:
        this.previewNode?.height ??
        node?.height ??
        this.canvasState.canvas.height,
      visibleWidth:
        this.previewNode?.width ?? node?.width ?? this.canvasState.canvas.width,
      width: this.canvasState.canvas.width,
    };
  }

  getArtboardClippedCanvas({ canvas, context, node }) {
    const clipBounds = getImageLocalClipBounds(this.editor, node);

    if (!(node?.type === "image" && clipBounds)) {
      return {
        canvas,
        context,
        node,
        transform: node?.transform || {},
      };
    }

    const minX = Math.max(0, Math.floor(clipBounds.minX));
    const minY = Math.max(0, Math.floor(clipBounds.minY));
    const maxX = Math.min(canvas.width, Math.ceil(clipBounds.maxX));
    const maxY = Math.min(canvas.height, Math.ceil(clipBounds.maxY));
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);

    if (
      minX === 0 &&
      minY === 0 &&
      width === canvas.width &&
      height === canvas.height
    ) {
      return {
        canvas,
        context,
        node,
        transform: node.transform,
      };
    }

    const nextCanvas = createCanvas(width, height);
    const nextContext = nextCanvas?.getContext("2d", {
      willReadFrequently: true,
    });

    if (!(nextCanvas && nextContext)) {
      return {
        canvas,
        context,
        node,
        transform: node.transform,
      };
    }

    nextContext.drawImage(
      canvas,
      minX,
      minY,
      width,
      height,
      0,
      0,
      width,
      height
    );

    const pinnedWorldPoint = getNodeWorldPoint(node, getImageNodeBounds(node), {
      x: minX,
      y: minY,
    });
    const nextNode = {
      ...node,
      height,
      width,
    };
    const transform = getNodeTransformForPinnedWorldPoint(
      nextNode,
      getImageNodeBounds(nextNode),
      { x: 0, y: 0 },
      pinnedWorldPoint
    );

    return {
      canvas: nextCanvas,
      context: nextContext,
      node: {
        ...nextNode,
        transform: {
          ...node.transform,
          ...transform,
        },
      },
      transform,
    };
  }

  getLocalPoint(point) {
    const durableNode = this.editor.getNode(this.nodeId);
    const node = this.usesCanvasOffset
      ? durableNode || this.previewNode
      : this.previewNode || durableNode;

    if (!node) {
      return point;
    }

    const localPoint = getImageLocalPoint(node, point);

    return this.usesCanvasOffset && !this.tileSurface
      ? {
          x: localPoint.x - this.canvasInputOffset.x,
          y: localPoint.y - this.canvasInputOffset.y,
        }
      : localPoint;
  }
}

const getRasterStrokeTarget = (editor, node) => {
  const writableBounds = getRasterWritableBounds(editor, node);
  const writablePolygon = getRasterWritablePolygon(editor, node);
  const bounds = writableBounds || {
    height: node.height,
    width: node.width,
    x: 0,
    y: 0,
  };

  return {
    bounds,
    id: node.id,
    pixelSize: {
      height: Math.max(1, Math.ceil(bounds.height)),
      width: Math.max(1, Math.ceil(bounds.width)),
    },
    ...(writableBounds ? { writableBounds } : {}),
    ...(writablePolygon ? { writablePolygon } : {}),
  };
};

const getLockedTargetProjection = (editor, targetState) => {
  if (targetState.kind === "existing") {
    const node = editor.getNode(targetState.nodeId);

    if (node?.type !== "image") {
      return null;
    }

    const bounds = getImageNodeBounds(node);

    return {
      target: getRasterStrokeTarget(editor, node),
      toTargetPoint: (point) => getImageLocalPoint(node, point),
      toWorldPoint: (point) => getNodeWorldPoint(node, bounds, point),
    };
  }

  const frame = editor.getNode(targetState.frameId);
  const bounds = editor.getNodeRenderFrame(frame?.id)?.bounds;

  if (!(frame?.type === "artboard" && bounds)) {
    return null;
  }

  return {
    target: {
      bounds: {
        height: bounds.height,
        width: bounds.width,
        x: bounds.minX,
        y: bounds.minY,
      },
      id: frame.id,
      pixelSize: {
        height: Math.max(1, Math.ceil(bounds.height)),
        width: Math.max(1, Math.ceil(bounds.width)),
      },
    },
    toTargetPoint: (point) => point,
    toWorldPoint: (point) => point,
  };
};

const getLockedTargetNodeId = (targetState) => {
  return targetState.kind === "existing" ||
    targetState.kind === "materialize"
    ? targetState.nodeId
    : null;
};

class DeferredBrushStrokeSession {
  constructor({ point, settings, targetState, tool }) {
    this.delegate = null;
    this.delegateDisconnected = false;
    this.lastDelegatePoint = null;
    this.previousPoint = point;
    this.preservePointerSamples = true;
    this.projection = getLockedTargetProjection(tool.editor, targetState);
    this.settings = settings;
    this.targetState = targetState;
    this.tool = tool;
    this.workingSurfaceId = null;
    this.activate(point, point);
  }

  get ready() {
    return this.delegate?.ready || Promise.resolve();
  }

  getWorkingGroup() {
    return this.delegate?.getWorkingGroup?.() || null;
  }

  getWorkingNodeId() {
    return (
      this.delegate?.getWorkingNodeId?.() ||
      getLockedTargetNodeId(this.targetState)
    );
  }

  acknowledgeWorkingPresentation(acknowledgement) {
    return Boolean(
      this.delegate?.acknowledgeWorkingPresentation?.(acknowledgement)
    );
  }

  failWorkingPresentation(failure) {
    return Boolean(this.delegate?.failWorkingPresentation?.(failure));
  }

  invalidateWorkingPresentation() {
    if (this.delegate) {
      this.delegate.invalidateWorkingPresentation?.();
      return;
    }

    this.tool.clearActiveSession(this);
  }

  resolveHistoryForInvalidation() {
    this.delegate?.resolveHistoryForInvalidation?.();
  }

  hasPendingWorkingSurface() {
    return Boolean(this.delegate?.hasPendingWorkingSurface?.());
  }

  getCommitReady() {
    return this.delegate?.getCommitReady?.() || Promise.resolve();
  }

  getHandoffReady() {
    return this.delegate?.getHandoffReady?.() || Promise.resolve();
  }

  getFollowupReady() {
    return this.delegate?.getFollowupReady?.() || this.getHandoffReady();
  }

  update({ point }) {
    if (this.delegate) {
      if (this.delegate.requiresFiniteInputClipping) {
        this.forwardClippedSegment(this.previousPoint, point);
      } else {
        this.delegate.update({ point });
      }
      this.previousPoint = point;
      return;
    }

    this.activate(this.previousPoint, point);
    this.previousPoint = point;
  }

  complete({ point }) {
    if (this.delegate) {
      if (this.delegate.requiresFiniteInputClipping) {
        this.forwardClippedSegment(this.previousPoint, point);
        this.previousPoint = point;
        return this.delegate.completeCurrent();
      }

      this.previousPoint = point;
      return this.delegate.complete({ point });
    }

    const activatedPoint = this.activate(this.previousPoint, point);
    this.previousPoint = point;

    if (this.delegate) {
      return this.delegate.requiresFiniteInputClipping
        ? this.delegate.completeCurrent()
        : this.delegate.complete({ point: activatedPoint || point });
    }

    this.tool.clearActiveSession(this);
    return Promise.resolve();
  }

  cancel() {
    if (this.delegate) {
      this.delegate.cancel();
      return;
    }

    this.tool.clearActiveSession(this);
  }

  activate(startPoint, endPoint) {
    if (!this.projection) {
      return null;
    }

    const clipped = clipRasterSegmentToTarget({
      end: this.projection.toTargetPoint(endPoint),
      radius: getRasterStrokeReach(this.settings),
      start: this.projection.toTargetPoint(startPoint),
      target: this.projection.target,
    });

    if (!clipped) {
      return null;
    }

    const clippedStartPoint = this.projection.toWorldPoint(clipped.start);
    const clippedEndPoint = this.projection.toWorldPoint(clipped.end);
    const targetNode = resolveBrushTargetState(
      this.tool.editor,
      this.targetState,
      clippedStartPoint,
      this.settings
    );

    if (!targetNode) {
      return null;
    }

    this.delegate = this.tool.beginResolvedStroke({
      node: targetNode,
      point: clippedStartPoint,
      settings: this.settings,
    });

    if (!this.delegate) {
      return null;
    }

    this.workingSurfaceId = this.delegate.workingSurfaceId || null;
    this.lastDelegatePoint = clippedStartPoint;

    if (
      clippedEndPoint.x !== clippedStartPoint.x ||
      clippedEndPoint.y !== clippedStartPoint.y
    ) {
      this.delegate.update({ point: clippedEndPoint });
    }
    this.lastDelegatePoint = clippedEndPoint;
    this.delegateDisconnected = !this.getClippedWorldSegment(
      endPoint,
      endPoint
    );

    return clippedEndPoint;
  }

  forwardClippedSegment(startPoint, endPoint) {
    const clipped = this.getClippedWorldSegment(startPoint, endPoint);

    if (!clipped) {
      this.delegateDisconnected = true;
      return null;
    }

    if (this.delegateDisconnected) {
      this.delegate.restart?.({ point: clipped.start });
      this.lastDelegatePoint = clipped.start;
    } else if (
      this.lastDelegatePoint &&
      (this.lastDelegatePoint.x !== clipped.start.x ||
        this.lastDelegatePoint.y !== clipped.start.y)
    ) {
      this.delegate.update({ point: clipped.start });
    }

    if (
      !this.lastDelegatePoint ||
      this.lastDelegatePoint.x !== clipped.end.x ||
      this.lastDelegatePoint.y !== clipped.end.y
    ) {
      this.delegate.update({ point: clipped.end });
    }

    this.delegateDisconnected = !this.getClippedWorldSegment(
      endPoint,
      endPoint
    );
    this.lastDelegatePoint = clipped.end;
    return clipped.end;
  }

  getClippedWorldSegment(startPoint, endPoint) {
    if (!this.projection) {
      return null;
    }

    const clipped = clipRasterSegmentToTarget({
      end: this.projection.toTargetPoint(endPoint),
      radius: getRasterStrokeReach(this.settings),
      start: this.projection.toTargetPoint(startPoint),
      target: this.projection.target,
    });

    return clipped
      ? {
          end: this.projection.toWorldPoint(clipped.end),
          start: this.projection.toWorldPoint(clipped.start),
        }
      : null;
  }
}

class CommitQueuedBrushStrokeSession {
  constructor({ point, settings, targetState, tool, waitFor }) {
    this.canceled = false;
    this.completePoint = null;
    this.completed = false;
    this.delegate = null;
    this.pendingPoints = [];
    this.point = point;
    this.preservePointerSamples = true;
    this.settings = settings;
    this.targetState = targetState;
    this.tool = tool;
    this.workingSurfaceId = null;
    this.ready = Promise.resolve(waitFor)
      .then((handoff) => {
        if (handoff?.status === "failed") {
          this.canceled = true;
          this.tool.clearActiveSession(this);
          return;
        }

        return this.activate();
      })
      .catch((error) => {
        this.canceled = true;
        this.pendingPoints = [];
        this.tool.clearPendingPreview(this);
        this.tool.clearActiveSession(this);
        throw error;
      });
  }

  getWorkingGroup() {
    return this.delegate?.getWorkingGroup?.() || null;
  }

  getWorkingNodeId() {
    return (
      this.delegate?.getWorkingNodeId?.() ||
      getLockedTargetNodeId(this.targetState)
    );
  }

  acknowledgeWorkingPresentation(acknowledgement) {
    return Boolean(
      this.delegate?.acknowledgeWorkingPresentation?.(acknowledgement)
    );
  }

  failWorkingPresentation(failure) {
    return Boolean(this.delegate?.failWorkingPresentation?.(failure));
  }

  invalidateWorkingPresentation() {
    this.canceled = true;
    this.pendingPoints = [];
    if (this.delegate) {
      this.delegate.invalidateWorkingPresentation?.();
      return;
    }

    this.tool.clearActiveSession(this);
  }

  resolveHistoryForInvalidation() {
    this.delegate?.resolveHistoryForInvalidation?.();
  }

  hasPendingWorkingSurface() {
    return (
      !this.delegate || Boolean(this.delegate.hasPendingWorkingSurface?.())
    );
  }

  getCommitReady() {
    return this.delegate?.getCommitReady?.() || this.ready;
  }

  getHandoffReady() {
    return this.ready.then(
      () => this.delegate?.getHandoffReady?.() || Promise.resolve()
    );
  }

  getFollowupReady() {
    return this.ready.then(
      () => this.delegate?.getFollowupReady?.() || Promise.resolve()
    );
  }

  update({ point }) {
    if (this.delegate) {
      this.delegate.update({ point });
      return;
    }

    this.pendingPoints.push(point);
  }

  complete({ point }) {
    if (this.delegate) {
      return this.delegate.complete({ point });
    }

    this.completePoint = point;
    this.completed = true;
    return this.ready;
  }

  cancel() {
    this.canceled = true;
    this.pendingPoints = [];
    this.delegate?.cancel();
    this.tool.clearActiveSession(this);
  }

  async activate() {
    if (this.canceled) {
      return;
    }

    this.delegate = new DeferredBrushStrokeSession({
      point: this.point,
      settings: this.settings,
      targetState: this.targetState,
      tool: this.tool,
    });
    this.workingSurfaceId = this.delegate.workingSurfaceId || null;

    for (const point of this.pendingPoints) {
      this.delegate.update({ point });
    }
    this.pendingPoints = [];

    if (this.completed && this.completePoint) {
      await this.delegate.complete({ point: this.completePoint });
    }
  }
}

const sessionContains = (session, candidate) => {
  return Boolean(
    session &&
      (session === candidate || sessionContains(session.delegate, candidate))
  );
};

export class BrushTool extends Tool {
  constructor(editor, operation = "paint") {
    super(editor);
    this.activeSession = null;
    this.operation = operation;
    this.pendingWorkingSurfaces = [];
  }

  getSettings() {
    const state = this.editor.getState();

    return (
      (this.operation === "erase"
        ? state.eraserSettings
        : state.brushSettings) || DEFAULT_BRUSH_SETTINGS
    );
  }

  hasActiveSession() {
    return Boolean(this.activeSession);
  }

  getWorkingGroups() {
    const activeGroup = this.activeSession?.getWorkingGroup?.();

    return [
      ...this.pendingWorkingSurfaces
        .map((entry) => entry.session.getWorkingGroup?.())
        .filter(Boolean),
      ...(activeGroup ? [activeGroup] : []),
    ].sort((left, right) => left.sequence - right.sequence);
  }

  getWorkingPresentationForNode(nodeId) {
    const groups = this.getWorkingGroups().filter(
      (group) => group.nodeId === nodeId
    );

    return groups.length > 0 ? { groups, nodeId } : null;
  }

  acknowledgeWorkingPresentation(acknowledgement) {
    return this.getSessions().some((session) =>
      session.acknowledgeWorkingPresentation?.(acknowledgement)
    );
  }

  failWorkingPresentation(failure) {
    return this.getSessions().some((session) =>
      session.failWorkingPresentation?.(failure)
    );
  }

  retireWorkingPresentations(groupIds) {
    for (const session of this.getSessions()) {
      const group = session.getWorkingGroup?.();

      if (group && groupIds.has(group.groupId)) {
        session.invalidateWorkingPresentation?.();
      }
    }
  }

  invalidateWorkingPresentations(nodeId = null) {
    for (const session of this.getSessions()) {
      if (!nodeId || session.getWorkingNodeId?.() === nodeId) {
        session.resolveHistoryForInvalidation?.();
        session.invalidateWorkingPresentation?.();
      }
    }
  }

  invalidateMissingWorkingPresentations() {
    for (const session of this.getSessions()) {
      const nodeId = session.getWorkingNodeId?.();

      if (nodeId && !this.editor.getNode(nodeId)) {
        session.resolveHistoryForInvalidation?.();
        session.invalidateWorkingPresentation?.();
      }
    }
  }

  getSessions() {
    return [
      ...this.pendingWorkingSurfaces.map((entry) => entry.session),
      ...(this.activeSession ? [this.activeSession] : []),
    ];
  }

  onCanvasPointerDown({ point }) {
    return this.beginStroke({ point });
  }

  onNodePointerDown({ node, point }) {
    return this.beginStroke({ node, point });
  }

  beginStroke({ point }) {
    return measurePerf("brush.stroke.begin", () => {
      const settings = this.getSettings();
      const targetState = getRasterTargetState(this.editor, {
        point,
        tool: this.operation === "erase" ? "eraser" : "brush",
      });

      if (!targetState.enabled) {
        recordRasterDebugEvent("target.missing", {
          activeLayerId: this.editor.activeLayerId,
          activeTool: this.editor.activeTool,
        });
        return null;
      }

      if (this.activeSession?.hasPendingWorkingSurface()) {
        const pendingSession = this.activeSession;

        recordRasterDebugEvent("tool.promotePendingWorkingSurface", {
          activeWorkingSurfaceId: pendingSession.workingSurfaceId,
          pendingSurfaceCount: this.pendingWorkingSurfaces.length,
        });
        this.pendingWorkingSurfaces = [
          ...this.pendingWorkingSurfaces.filter(
            (entry) => entry.session !== pendingSession
          ),
          {
            session: pendingSession,
          },
        ];
        const targetNodeId = getLockedTargetNodeId(targetState);
        const followsPendingNode =
          Boolean(targetNodeId) &&
          pendingSession.getWorkingNodeId?.() === targetNodeId;
        const session = followsPendingNode
          ? new CommitQueuedBrushStrokeSession({
              point,
              settings,
              targetState,
              tool: this,
              waitFor:
                pendingSession.getFollowupReady?.() ||
                pendingSession.getHandoffReady?.(),
            })
          : new DeferredBrushStrokeSession({
              point,
              settings,
              targetState,
              tool: this,
            });

        this.activeSession = session;
        this.editor.notifyInteractionPreviewChanged();
        return session;
      }

      const session = new DeferredBrushStrokeSession({
        point,
        settings,
        targetState,
        tool: this,
      });
      this.activeSession = session;
      this.editor.notifyInteractionPreviewChanged();

      return session;
    });
  }

  beginResolvedStroke({ node, point, settings }) {
    const targetsExistingRaster =
      this.editor.getNode(node.id)?.type === "image";

    if (
      !targetsExistingRaster &&
      !hasRasterRuntime() &&
      this.editor.rasterSurface?.resolveSurface
    ) {
      const historyMark = this.editor.markHistoryStep(
        this.operation === "erase"
          ? "erase brush stroke"
          : "paint brush stroke"
      );

      this.editor.run(() => {
        materializeBrushTarget(this.editor, node);
      });
      const residentSession = this.beginResidentStroke({
        node,
        point,
        settings,
      });

      if (!residentSession) {
        this.editor.revertToMark(historyMark);
        return null;
      }

      const materializedSession = {
        cancel: () => {
          residentSession.cancel();
          this.editor.revertToMark(historyMark);
          this.clearActiveSession(materializedSession);
        },
        complete: async (info) => {
          try {
            const commit = await residentSession.complete(info);
            this.editor.commitHistoryStep(historyMark);
            return commit;
          } catch (error) {
            this.editor.revertToMark(historyMark);
            throw error;
          } finally {
            this.clearActiveSession(materializedSession);
          }
        },
        getWorkingGroup: () => null,
        hasPendingWorkingSurface: () => false,
        update: (info) => residentSession.update(info),
      };

      return materializedSession;
    }

    const residentSession = this.beginResidentStroke({ node, point, settings });

    if (residentSession) {
      return residentSession;
    }

    if (!hasRasterRuntime()) {
      return null;
    }

    return new BrushStrokeSession({
      editor: this.editor,
      node,
      operation: this.operation,
      settings,
      startPoint: getImageLocalPoint(node, point),
      tool: this,
    });
  }

  beginResidentStroke({ node: targetNode, point, settings }) {
    if (
      !(
        targetNode?.type === "image" &&
        !(targetNode.tileSources || []).length &&
        (targetNode.baseX ?? 0) === 0 &&
        (targetNode.baseY ?? 0) === 0 &&
        (targetNode.baseWidth ?? targetNode.width) === targetNode.width &&
        (targetNode.baseHeight ?? targetNode.height) === targetNode.height &&
        Math.max(targetNode.width, targetNode.height) <=
          RESIDENT_RASTER_MAX_EDGE &&
        !shouldUseTiledPaintSurface({
          editor: this.editor,
          node: targetNode,
          operation: this.operation,
          sourceRect: null,
        }) &&
        this.editor.getNode(targetNode.id)?.type === "image"
      )
    ) {
      return null;
    }

    const target = getRasterStrokeTarget(this.editor, targetNode);
    const surface = this.editor.rasterSurface?.resolveSurface?.(target);

    if (!surface) {
      return null;
    }

    const stroke = measurePerf(PERF_SPANS.rasterStrokeBegin, () =>
      createRasterStroke({
        operation: this.operation,
        point: getImageLocalPoint(targetNode, point),
        settings,
        surface,
        target,
      })
    );
    let active = true;
    const finish = () => {
      if (!active) {
        return;
      }

      active = false;
      this.clearActiveSession(session);
    };
    const session = {
      cancel: () => {
        stroke.cancel();
        finish();
      },
      complete: ({ point: endPoint }) => {
        const commit = measurePerf(PERF_SPANS.rasterStrokePointerRelease, () => {
          stroke.append([getImageLocalPoint(targetNode, endPoint)]);
          return stroke.commit();
        });
        finish();
        return Promise.resolve(commit);
      },
      getWorkingGroup: () => null,
      hasPendingWorkingSurface: () => false,
      update: ({ point: nextPoint }) => {
        stroke.append([getImageLocalPoint(targetNode, nextPoint)]);
      },
    };

    return session;
  }

  clearPendingPreview(session) {
    const nextWorkingSurfaces = this.pendingWorkingSurfaces.filter((entry) => {
      return !sessionContains(entry.session, session);
    });

    if (nextWorkingSurfaces.length === this.pendingWorkingSurfaces.length) {
      return;
    }

    this.pendingWorkingSurfaces = nextWorkingSurfaces;
    recordRasterDebugEvent("tool.clearPendingPreview", {
      pendingSurfaceCount: this.pendingWorkingSurfaces.length,
      workingSurfaceId: session.workingSurfaceId,
    });
    this.editor.notifyInteractionPreviewChanged();
  }

  clearActiveSession(session) {
    if (sessionContains(this.activeSession, session)) {
      this.activeSession = null;
      recordRasterDebugEvent("tool.clearActiveSession", {
        workingSurfaceId: session.workingSurfaceId,
      });
      this.editor.notifyInteractionPreviewChanged();
    }
  }

  onKeyDown({ event, key }) {
    if (key === "escape") {
      this.editor.setActiveTool("pointer");
      return true;
    }

    return selectToolFromShortcut(this.editor, key, event);
  }
}
