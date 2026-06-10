import { getImageNodeBounds } from "../nodes/image/image-capabilities";
import { getNodeScaleX } from "../nodes/text/model";
import { incrementPerfCounter, measurePerf } from "../perf/perf-hooks";
import {
  getNodeTransformForPinnedWorldPoint,
  getNodeWorldPoint,
} from "../primitives/rotation";
import {
  getBrushDabCoverage,
  getBrushDabRenderRadius,
  getBrushDabSpacing,
  getErasedAlpha,
  getPaintedAlpha,
} from "./brush-mask";
import {
  cancelRasterFrame,
  canScheduleRasterFrame,
  createCanvas,
  getNow,
  hasRasterRuntime,
  loadImageToCanvas,
  requestRasterFrame,
} from "./brush-runtime";
import { DEFAULT_BRUSH_SETTINGS, getBrushColorRgb } from "./brush-settings";
import {
  getArtboardClipSourceRect,
  getImageLocalClipBounds,
  getImageLocalPoint,
  getImageNodeCroppedToSourceRect,
  materializeBrushTarget,
  resolveBrushTarget,
} from "./brush-target";
import { RASTER_TILE_SIZE, RasterTileSurface } from "./raster-tile-surface";
import { selectToolFromShortcut, Tool } from "./tool";

const BRUSH_LAYER_EXPANSION_PADDING_MULTIPLIER = 8;
const BRUSH_STROKE_POINT_FLUSH_BUDGET_MS = 5;
const BRUSH_TILE_ASYNC_COMMIT_THRESHOLD = 64;
const BRUSH_TILE_COMMIT_BUDGET_MS = 8;
const RASTER_NODE_RENDER_READY_EVENT = "punchpress:raster-node-render-ready";
const TILED_BRUSH_SURFACE_AREA_THRESHOLD = 4096 * 4096;
const TILED_BRUSH_SURFACE_DENSITY_THRESHOLD = 8;
let brushWorkingSurfaceRevision = 0;
let brushTileCommitRevision = 0;

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

const getBrushLayerExpansionPadding = (settings) => {
  return Math.max(
    2,
    Math.ceil(settings.size * BRUSH_LAYER_EXPANSION_PADDING_MULTIPLIER)
  );
};

const shouldUseNativeStroke = (settings) => {
  return (
    settings.hardness >= 1 && settings.opacity >= 1 && settings.spacing <= 0
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

  return (
    operation === "paint" &&
    !sourceRect &&
    ((node.tileSources || []).length > 0 ||
      forceTiled ||
      node.width * node.height >= TILED_BRUSH_SURFACE_AREA_THRESHOLD ||
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

const getTileSourcesRenderKey = (tileSources = []) =>
  tileSources.map((tileSource) => tileSource.ref).join("|");

const getTiledBaseFrame = (node) => {
  if ((node.tileSources || []).length > 0) {
    return {
      baseHeight: node.baseHeight ?? node.height,
      baseWidth: node.baseWidth ?? node.width,
      baseX: node.baseX ?? 0,
      baseY: node.baseY ?? 0,
    };
  }

  return {
    baseHeight: node.height,
    baseWidth: node.width,
    baseX: 0,
    baseY: 0,
  };
};

const getNextTiledImageNodeState = ({ node, tileSources }) => {
  const nextTileSourcesByRef = new Map(
    (node.tileSources || []).map((tileSource) => [tileSource.ref, tileSource])
  );

  for (const tileSource of tileSources) {
    nextTileSourcesByRef.set(tileSource.ref, tileSource);
  }

  const existingTileSources = [...nextTileSourcesByRef.values()];
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
    this.completed = false;
    this.commitHandoffCancel = null;
    this.dirtyBounds = null;
    this.editor = editor;
    this.historyMark = editor.markHistoryStep(
      operation === "erase" ? "erase brush stroke" : "paint brush stroke"
    );
    this.initialSourceRect = getArtboardClipSourceRect(editor, node);
    this.preserveRasterPlane =
      editor.getNode(node.id)?.type === "image" && !this.initialSourceRect;
    this.commitReady = Promise.resolve();
    this.commitRenderKey = null;
    this.floatPixels = null;
    this.lastPoint = null;
    this.nodeId = node.id;
    this.operation = operation;
    this.pointFlushFrameId = 0;
    this.pointReadIndex = 0;
    this.points = [];
    this.previewFrameId = 0;
    brushWorkingSurfaceRevision += 1;
    this.workingSurfaceId = `brush-working-${brushWorkingSurfaceRevision}`;
    this.previewNeedsNotify = false;
    this.previewNode = getImageNodeCroppedToSourceRect(
      node,
      this.initialSourceRect
    );
    this.usesNativeStroke = shouldUseNativeStroke(settings);
    this.settings = settings;
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
            this.commit();
          }
        })
      : loadImageToCanvas(node, this.initialSourceRect).then((canvasState) => {
          this.canvasState = canvasState;
          this.floatPixels =
            canvasState && !this.usesNativeStroke
              ? measurePerf("brush.stroke.createFloatPixels", () =>
                  createFloatPixelState(canvasState)
                )
              : null;
          this.flushPoints();

          if (this.completed) {
            this.commit();
          }
        });
    this.tool = tool;

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
    if (!this.initialSourceRect) {
      return point;
    }

    return {
      x: point.x - this.initialSourceRect.x,
      y: point.y - this.initialSourceRect.y,
    };
  }

  addPoint(point) {
    this.points.push(point);
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
        const point = this.points[this.pointReadIndex];

        this.pointReadIndex += 1;
        this.applyPoint(point);
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

    const adjustedPoint = this.ensureCanvasIncludesDab(point);

    if (this.usesNativeStroke) {
      if (!this.lastPoint) {
        this.applyNativeStroke(adjustedPoint, adjustedPoint);
        this.lastPoint = adjustedPoint;
        return;
      }

      this.applyNativeStroke(this.lastPoint, adjustedPoint);
      this.lastPoint = adjustedPoint;
      return;
    }

    if (!this.lastPoint) {
      this.applyDab(adjustedPoint);
      this.lastPoint = adjustedPoint;
      return;
    }

    const distance = Math.hypot(
      adjustedPoint.x - this.lastPoint.x,
      adjustedPoint.y - this.lastPoint.y
    );
    const spacing = getBrushDabSpacing(
      this.settings.size,
      this.settings.spacing,
      this.settings.hardness
    );
    const steps = Math.max(1, Math.ceil(distance / spacing));

    for (let index = 1; index <= steps; index += 1) {
      const progress = index / steps;
      this.applyDab({
        x: this.lastPoint.x + (adjustedPoint.x - this.lastPoint.x) * progress,
        y: this.lastPoint.y + (adjustedPoint.y - this.lastPoint.y) * progress,
      });
    }

    incrementPerfCounter("brush.dab", steps);
    this.lastPoint = adjustedPoint;
  }

  applyTiledPoint(point) {
    if (this.usesNativeStroke) {
      if (!this.lastPoint) {
        this.applyTiledNativeStroke(point, point);
        this.lastPoint = point;
        return;
      }

      this.applyTiledNativeStroke(this.lastPoint, point);
      this.lastPoint = point;
      return;
    }

    if (!this.lastPoint) {
      this.applyTiledDab(point);
      this.lastPoint = point;
      return;
    }

    const distance = Math.hypot(
      point.x - this.lastPoint.x,
      point.y - this.lastPoint.y
    );
    const spacing = getBrushDabSpacing(
      this.settings.size,
      this.settings.spacing,
      this.settings.hardness
    );
    const steps = Math.max(1, Math.ceil(distance / spacing));

    for (let index = 1; index <= steps; index += 1) {
      const progress = index / steps;
      this.applyTiledDab({
        x: this.lastPoint.x + (point.x - this.lastPoint.x) * progress,
        y: this.lastPoint.y + (point.y - this.lastPoint.y) * progress,
      });
    }

    incrementPerfCounter("brush.dab", steps);
    this.lastPoint = point;
  }

  applyNativeStroke(startPoint, endPoint) {
    const { context } = this.canvasState;
    const renderRadius = getBrushDabRenderRadius(
      this.settings.size,
      this.settings.hardness
    );
    const bounds = {
      maxX: Math.ceil(Math.max(startPoint.x, endPoint.x) + renderRadius),
      maxY: Math.ceil(Math.max(startPoint.y, endPoint.y) + renderRadius),
      minX: Math.floor(Math.min(startPoint.x, endPoint.x) - renderRadius),
      minY: Math.floor(Math.min(startPoint.y, endPoint.y) - renderRadius),
    };

    measurePerf("brush.nativeStroke.draw", () => {
      const color = getBrushColorRgb(this.settings.color);

      context.save();
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

      if (startPoint.x === endPoint.x && startPoint.y === endPoint.y) {
        context.beginPath();
        context.arc(
          endPoint.x,
          endPoint.y,
          this.settings.size / 2,
          0,
          Math.PI * 2
        );
        context.fill();
      } else {
        context.beginPath();
        context.moveTo(startPoint.x, startPoint.y);
        context.lineTo(endPoint.x, endPoint.y);
        context.stroke();
      }

      context.restore();
    });

    incrementPerfCounter("brush.nativeStroke.segment");
    this.recordDirtyBounds(bounds);
    this.scheduleLivePreview();
  }

  applyTiledNativeStroke(startPoint, endPoint) {
    const renderRadius = getBrushDabRenderRadius(
      this.settings.size,
      this.settings.hardness
    );
    const bounds = {
      maxX: Math.ceil(Math.max(startPoint.x, endPoint.x) + renderRadius),
      maxY: Math.ceil(Math.max(startPoint.y, endPoint.y) + renderRadius),
      minX: Math.floor(Math.min(startPoint.x, endPoint.x) - renderRadius),
      minY: Math.floor(Math.min(startPoint.y, endPoint.y) - renderRadius),
    };

    this.tileSurface.drawNativeStroke({
      bounds,
      color: getBrushColorRgb(this.settings.color),
      endPoint,
      lineWidth: this.settings.size,
      startPoint,
    });

    incrementPerfCounter("brush.nativeStroke.segment");
    this.recordDirtyBounds(bounds);
    this.scheduleLivePreview();
  }

  applyTiledDab(point) {
    const radius = this.settings.size / 2;
    const hardness = clamp(this.settings.hardness, 0, 1);
    const renderRadius = getBrushDabRenderRadius(this.settings.size, hardness);
    const bounds = {
      maxX: Math.ceil(point.x + renderRadius),
      maxY: Math.ceil(point.y + renderRadius),
      minX: Math.floor(point.x - renderRadius),
      minY: Math.floor(point.y - renderRadius),
    };

    this.tileSurface.drawPaintDab({
      bounds,
      color: getBrushColorRgb(this.settings.color),
      getCoverage: (x, y, centerPoint) => {
        const dx = x - centerPoint.x;
        const dy = y - centerPoint.y;
        const normalizedDistanceSquared =
          (dx * dx + dy * dy) / (radius * radius);

        return getBrushDabCoverage(normalizedDistanceSquared, hardness, radius);
      },
      opacity: this.settings.opacity,
      point,
    });

    this.recordDirtyBounds(bounds);
    this.scheduleLivePreview();
  }

  applyDab(point) {
    const { canvas, context } = this.canvasState;

    if (!this.floatPixels) {
      this.floatPixels = createFloatPixelState(this.canvasState);
    }

    const radius = this.settings.size / 2;
    const hardness = clamp(this.settings.hardness, 0, 1);
    const renderRadius = getBrushDabRenderRadius(this.settings.size, hardness);
    const minX = Math.max(0, Math.floor(point.x - renderRadius));
    const minY = Math.max(0, Math.floor(point.y - renderRadius));
    const maxX = Math.min(canvas.width - 1, Math.ceil(point.x + renderRadius));
    const maxY = Math.min(canvas.height - 1, Math.ceil(point.y + renderRadius));

    if (maxX < minX || maxY < minY) {
      return;
    }

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const imageData = context.getImageData(minX, minY, width, height);
    const data = imageData.data;
    const color = getBrushColorRgb(this.settings.color);

    for (let localY = 0; localY < height; localY += 1) {
      for (let localX = 0; localX < width; localX += 1) {
        const x = minX + localX;
        const y = minY + localY;
        const dx = x + 0.5 - point.x;
        const dy = y + 0.5 - point.y;
        const normalizedDistanceSquared =
          (dx * dx + dy * dy) / (radius * radius);
        const falloff = getBrushDabCoverage(
          normalizedDistanceSquared,
          hardness,
          radius
        );

        if (falloff <= 0) {
          continue;
        }

        const alpha = clamp(falloff * this.settings.opacity, 0, 1);
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

  ensureCanvasIncludesDab(point) {
    if (this.operation === "erase") {
      return point;
    }

    const { canvas } = this.canvasState;
    const clipBounds = getImageLocalClipBounds(
      this.editor,
      this.previewNode || this.editor.getNode(this.nodeId)
    );
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
    const maxLeft = clipBounds
      ? Math.max(0, Math.ceil(-clipBounds.minX))
      : Number.POSITIVE_INFINITY;
    const maxTop = clipBounds
      ? Math.max(0, Math.ceil(-clipBounds.minY))
      : Number.POSITIVE_INFINITY;
    const maxRight = clipBounds
      ? Math.max(0, Math.ceil(clipBounds.maxX - canvas.width))
      : Number.POSITIVE_INFINITY;
    const maxBottom = clipBounds
      ? Math.max(0, Math.ceil(clipBounds.maxY - canvas.height))
      : Number.POSITIVE_INFINITY;
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
      this.canvasOffset = {
        x: this.canvasOffset.x - left,
        y: this.canvasOffset.y - top,
      };
      this.expandFloatPixels({ bottom, left, right, top });

      if (this.lastPoint) {
        this.lastPoint = {
          x: this.lastPoint.x + left,
          y: this.lastPoint.y + top,
        };
      }

      this.points = this.points.map((queuedPoint) => ({
        x: queuedPoint.x + left,
        y: queuedPoint.y + top,
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

  update({ point }) {
    this.addPoint(this.getLocalPoint(point));
  }

  complete({ point }) {
    recordRasterDebugEvent("session.complete.start", {
      nodeId: this.nodeId,
      pendingPointCount: this.points.length,
      tileSurface: Boolean(this.tileSurface),
      workingSurfaceId: this.workingSurfaceId,
    });
    this.addPoint(this.getLocalPoint(point));
    this.completed = true;
    this.cancelQueuedPointFlush();

    if (this.canvasState || this.tileSurface) {
      this.flushPoints();
      recordRasterDebugEvent("session.complete.flushed", {
        dirtyBounds: this.dirtyBounds,
        dirtyTileCount: this.tileSurface?.getDirtyTiles().length || 0,
        nodeId: this.nodeId,
        workingSurfaceId: this.workingSurfaceId,
      });
      this.commitReady = this.commit();
    }

    return this.commitReady;
  }

  cancel() {
    this.clearCommitHandoffWait();
    this.cancelQueuedPointFlush();
    this.cancelLivePreview();
    this.editor.revertToMark(this.historyMark);
    this.tool.clearPendingPreview(this);
    this.tool.clearActiveSession(this);
  }

  commit() {
    if (!this.completed) {
      return this.commitReady;
    }

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
      this.editor.revertToMark(this.historyMark);
      this.tool.clearActiveSession(this);
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

    measurePerf("brush.commit.updateNode", () =>
      this.editor.run(() => {
        this.editor.getState().updateNodeById(this.nodeId, (node) => {
          if (node.type !== "image") {
            return node;
          }

          return {
            ...node,
            baseHeight: committedCanvas.height,
            baseWidth: committedCanvas.width,
            baseX: 0,
            baseY: 0,
            height: committedCanvas.height,
            mimeType: "image/png",
            src,
            transform: {
              ...node.transform,
              ...committedCanvas.transform,
            },
            width: committedCanvas.width,
          };
        });
      })
    );
    this.editor.commitHistoryStep(this.historyMark);
    this.completed = false;
    recordRasterDebugEvent("commit.canvas.finish", {
      node: getRasterDebugNodePayload(this.editor.getNode(this.nodeId)),
      workingSurfaceId: this.workingSurfaceId,
    });
    this.tool.clearPendingPreview(this);
    this.tool.clearActiveSession(this);
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
      this.editor.revertToMark(this.historyMark);
      this.tool.clearPendingPreview(this);
      this.tool.clearActiveSession(this);
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
    return new Promise((resolve) => {
      const tileSources: NonNullable<
        ReturnType<typeof createTileSourceFromDirtyTile>
      >[] = [];
      let tileIndex = 0;
      const encodeChunk = () => {
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
        };

      requestRasterFrame(encodeChunk);
    });
  }

  finishTileSurfaceCommit(tileSources) {
    if (tileSources.length === 0) {
      recordRasterDebugEvent("tileCommit.emptyEncodedTiles", {
        nodeId: this.nodeId,
        workingSurfaceId: this.workingSurfaceId,
      });
      this.editor.revertToMark(this.historyMark);
      this.tool.clearPendingPreview(this);
      this.tool.clearActiveSession(this);
      return;
    }

    let committedNode = null;

    measurePerf("brush.tile.commit.updateNode", () =>
      this.editor.run(() => {
        this.editor.getState().updateNodeById(this.nodeId, (node) => {
          if (node.type !== "image") {
            return node;
          }

          committedNode = getNextTiledImageNodeState({ node, tileSources });
          return committedNode;
        });
      })
    );
    this.commitRenderKey =
      committedNode?.type === "image"
        ? getTileSourcesRenderKey(committedNode.tileSources || [])
        : null;
    this.editor.commitHistoryStep(this.historyMark);
    recordRasterDebugEvent("tileCommit.finish", {
      committedNode: getRasterDebugNodePayload(committedNode),
      commitRenderKeyLength: this.commitRenderKey?.length || 0,
      encodedTileCount: tileSources.length,
      nodeId: this.nodeId,
      workingSurfaceId: this.workingSurfaceId,
    });
    this.scheduleCommitWorkingSurfaceClear();
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

  cancelLivePreview() {
    if (!this.previewFrameId) {
      this.previewFrameId = 0;
      return;
    }

    cancelRasterFrame(this.previewFrameId);
    this.previewFrameId = 0;
  }

  clearCommitHandoffWait() {
    if (!this.commitHandoffCancel) {
      return;
    }

    this.commitHandoffCancel();
    this.commitHandoffCancel = null;
  }

  scheduleCommitWorkingSurfaceClear() {
    const clear = () => {
      recordRasterDebugEvent("handoff.clear", {
        commitRenderKeyLength: this.commitRenderKey?.length || 0,
        nodeId: this.nodeId,
        workingSurfaceId: this.workingSurfaceId,
      });
      this.clearCommitHandoffWait();
      this.completed = false;
      this.tool.clearPendingPreview(this);
      this.tool.clearActiveSession(this);
    };

    if (!canScheduleRasterFrame() || !this.commitRenderKey) {
      recordRasterDebugEvent("handoff.clearImmediate", {
        canScheduleRasterFrame: canScheduleRasterFrame(),
        commitRenderKeyLength: this.commitRenderKey?.length || 0,
        nodeId: this.nodeId,
        workingSurfaceId: this.workingSurfaceId,
      });
      clear();
      return;
    }

    const expectedRenderKey = this.commitRenderKey;
    recordRasterDebugEvent("handoff.wait", {
      expectedRenderKeyLength: expectedRenderKey.length,
      nodeId: this.nodeId,
      workingSurfaceId: this.workingSurfaceId,
    });

    const onRenderReady = (event) => {
      const detail = event?.detail || {};

      if (
        detail.nodeId === this.nodeId &&
        detail.renderKey === expectedRenderKey
      ) {
        recordRasterDebugEvent("handoff.renderReady", {
          mode: detail.mode || null,
          nodeId: this.nodeId,
          renderKeyLength: detail.renderKey?.length || 0,
          workingSurfaceId: this.workingSurfaceId,
        });
        clear();
      }
    };

    window.addEventListener(RASTER_NODE_RENDER_READY_EVENT, onRenderReady);
    this.commitHandoffCancel = () => {
      window.removeEventListener(RASTER_NODE_RENDER_READY_EVENT, onRenderReady);
    };
  }

  hasPendingWorkingSurface() {
    return this.completed && Boolean(this.getWorkingSurfaceState());
  }

  getWorkingSurfaceState() {
    const node = this.previewNode || this.editor.getNode(this.nodeId);

    if (!node) {
      return null;
    }

    if (this.tileSurface) {
      const workingSurface = this.tileSurface.createDirtyWorkingTiles();

      if (!workingSurface?.tiles.length) {
        return null;
      }

      return {
        completed: this.completed,
        height: node.height,
        nodeId: this.nodeId,
        tiles: workingSurface.tiles,
        transform: node.transform || {},
        type: "tiles",
        width: node.width,
        workingSurfaceId: this.workingSurfaceId,
      };
    }

    if (!this.canvasState) {
      return null;
    }

    return {
      canvas: this.canvasState.canvas,
      completed: this.completed,
      height: this.canvasState.canvas.height,
      nodeId: this.nodeId,
      replacesNode: true,
      transform: this.previewNode?.transform || node.transform || {},
      type: "canvas",
      width: this.canvasState.canvas.width,
      workingSurfaceId: this.workingSurfaceId,
      x: this.canvasOffset.x,
      y: this.canvasOffset.y,
    };
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
      canvas: this.canvasState.canvas,
      height: this.canvasState.canvas.height,
      transform: this.previewNode?.transform || node?.transform || {},
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
    const node = this.previewNode || this.editor.getNode(this.nodeId);

    if (!node) {
      return point;
    }

    return getImageLocalPoint(node, point);
  }
}

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

  getWorkingSurfaceStates() {
    const activeSurface = this.activeSession?.getWorkingSurfaceState();

    return [
      ...this.pendingWorkingSurfaces
        .map((entry) => entry.session.getWorkingSurfaceState())
        .filter(Boolean),
      ...(activeSurface ? [activeSurface] : []),
    ];
  }

  getWorkingSurfaceStateForNode(nodeId) {
    const surfaces = this.getWorkingSurfaceStates().filter(
      (surface) => surface?.nodeId === nodeId
    );

    if (surfaces.length <= 1) {
      return surfaces[0] || null;
    }

    if (surfaces.every((surface) => surface.type === "tiles")) {
      const [firstSurface] = surfaces;

      return {
        ...firstSurface,
        workingSurfaceId: surfaces
          .map((surface) => surface.workingSurfaceId)
          .join(":"),
        tiles: surfaces.flatMap((surface) => surface.tiles),
      };
    }

    return surfaces.at(-1) || null;
  }

  onCanvasPointerDown({ point }) {
    return this.beginStroke({ point });
  }

  onNodePointerDown({ node, point }) {
    return this.beginStroke({ node, point });
  }

  beginStroke({ node = null, point }) {
    if (!hasRasterRuntime()) {
      return null;
    }

    return measurePerf("brush.stroke.begin", () => {
      if (this.activeSession?.hasPendingWorkingSurface()) {
        recordRasterDebugEvent("tool.promotePendingWorkingSurface", {
          activeWorkingSurfaceId: this.activeSession.workingSurfaceId,
          pendingSurfaceCount: this.pendingWorkingSurfaces.length,
        });
        this.pendingWorkingSurfaces = [
          ...this.pendingWorkingSurfaces.filter(
            (entry) => entry.session !== this.activeSession
          ),
          {
            session: this.activeSession,
          },
        ];
      }

      const settings = this.getSettings();
      const targetNode = measurePerf("brush.target.resolve", () =>
        resolveBrushTarget(this.editor, point, node, settings)
      );

      if (!targetNode) {
        recordRasterDebugEvent("target.missing", {
          activeTool: this.editor.activeTool,
          selectedNodeIds: this.editor.selectedNodeIds,
        });
        return null;
      }

      const localPoint = getImageLocalPoint(targetNode, point);

      const session = new BrushStrokeSession({
        editor: this.editor,
        node: targetNode,
        operation: this.operation,
        settings,
        startPoint: localPoint,
        tool: this,
      });
      this.activeSession = session;
      this.editor.notifyInteractionPreviewChanged();

      return session;
    });
  }

  clearPendingPreview(session) {
    const nextWorkingSurfaces = this.pendingWorkingSurfaces.filter(
      (entry) => entry.session !== session
    );

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
    if (this.activeSession === session) {
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
