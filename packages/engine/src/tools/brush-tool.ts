import { getImageNodeBounds } from "../nodes/image/image-capabilities";
import { incrementPerfCounter, measurePerf } from "../perf/perf-hooks";
import {
  getNodeTransformForPinnedWorldPoint,
  getNodeWorldPoint,
} from "../primitives/rotation";
import {
  mergeStrokeStore,
  RASTER_STORE_TILE_SIZE,
  RasterTileStore,
} from "../raster/raster-tile-store";
import {
  getBrushDabCoverage,
  getBrushDabRenderRadius,
  getBrushDabSpacing,
} from "./brush-mask";
import {
  cancelRasterFrame,
  canScheduleRasterFrame,
  createCanvas,
  getNow,
  hasRasterRuntime,
  requestRasterFrame,
} from "./brush-runtime";
import { DEFAULT_BRUSH_SETTINGS, getBrushColorRgb } from "./brush-settings";
import {
  getArtboardClipSourceRect,
  getImageLocalPoint,
  getImageNodeCroppedToSourceRect,
  materializeBrushTarget,
  resolveBrushTarget,
} from "./brush-target";
import { selectToolFromShortcut, Tool } from "./tool";

const BRUSH_STROKE_POINT_FLUSH_BUDGET_MS = 5;
const BRUSH_TILE_ASYNC_COMMIT_THRESHOLD = 64;
const BRUSH_TILE_COMMIT_BUDGET_MS = 8;
let brushStrokeSessionRevision = 0;
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
    col: Math.floor(x / RASTER_STORE_TILE_SIZE),
    row: Math.floor(y / RASTER_STORE_TILE_SIZE),
    x,
    y,
  };
};

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
    node: {
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
    },
    offsetX,
    offsetY,
  };
};

const createTileSourceFromDirtyTile = ({
  commitRevision,
  nodeId,
  offsetX,
  offsetY,
  tile,
}) => {
  const alphaBounds = getAlphaBounds({
    data: tile.pixels,
    height: tile.height,
    width: tile.width,
  });

  if (!alphaBounds) {
    return null;
  }

  const width = alphaBounds.maxX - alphaBounds.minX + 1;
  const height = alphaBounds.maxY - alphaBounds.minY + 1;
  const x = tile.x + alphaBounds.minX + offsetX;
  const y = tile.y + alphaBounds.minY + offsetY;
  const canvas = createCanvas(width, height);
  const context = canvas?.getContext("2d", { willReadFrequently: true });

  if (!(canvas && context)) {
    return null;
  }

  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let row = 0; row < height; row += 1) {
    const sourceOffset =
      ((alphaBounds.minY + row) * tile.width + alphaBounds.minX) * 4;

    pixels.set(
      tile.pixels.subarray(sourceOffset, sourceOffset + width * 4),
      row * width * 4
    );
  }

  context.putImageData(new ImageData(pixels, width, height), 0, 0);

  const col = Math.floor(x / RASTER_STORE_TILE_SIZE);
  const row = Math.floor(y / RASTER_STORE_TILE_SIZE);

  return {
    col,
    height,
    ref: `assets/raster/${nodeId}/tiles/${commitRevision}_${col}_${row}.png`,
    row,
    src: canvas.toDataURL("image/png"),
    width,
    x,
    y,
  };
};

const drawStoreTilesToCanvas = ({ anchorX, anchorY, context, rect, store }) => {
  const storeBounds = {
    maxX: rect.x + rect.width - anchorX,
    maxY: rect.y + rect.height - anchorY,
    minX: rect.x - anchorX,
    minY: rect.y - anchorY,
  };

  for (const tile of store.getTilesForBounds(storeBounds, { create: false })) {
    const scratch = createCanvas(tile.width, tile.height);
    const scratchContext = scratch?.getContext("2d", {
      willReadFrequently: true,
    });

    if (!(scratch && scratchContext)) {
      continue;
    }

    scratchContext.putImageData(
      new ImageData(tile.pixels, tile.width, tile.height),
      0,
      0
    );
    context.drawImage(
      scratch,
      tile.nominalX - tile.x,
      tile.nominalY - tile.y,
      tile.nominalWidth,
      tile.nominalHeight,
      tile.nominalX + anchorX - rect.x,
      tile.nominalY + anchorY - rect.y,
      tile.nominalWidth,
      tile.nominalHeight
    );
  }
};

const getTrimmedFlattenState = ({ canvas, context, frameNode }) => {
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const alphaBounds = getAlphaBounds(imageData);

  if (!alphaBounds) {
    return null;
  }

  const width = alphaBounds.maxX - alphaBounds.minX + 1;
  const height = alphaBounds.maxY - alphaBounds.minY + 1;

  if (
    alphaBounds.minX === 0 &&
    alphaBounds.minY === 0 &&
    width === canvas.width &&
    height === canvas.height
  ) {
    return null;
  }

  const nextCanvas = createCanvas(width, height);
  const nextContext = nextCanvas?.getContext("2d", {
    willReadFrequently: true,
  });

  if (!(nextCanvas && nextContext)) {
    return null;
  }

  nextContext.drawImage(
    canvas,
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
    frameNode,
    getImageNodeBounds(frameNode),
    {
      x: alphaBounds.minX,
      y: alphaBounds.minY,
    }
  );
  const nextNode = {
    ...frameNode,
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
    trimX: alphaBounds.minX,
    trimY: alphaBounds.minY,
    width,
  };
};

class BrushStrokeSession {
  constructor({ editor, node, operation, settings, startPoint, tool }) {
    this.completed = false;
    this.dirtyBounds = null;
    this.editor = editor;
    this.historyMark = editor.markHistoryStep(
      operation === "erase" ? "erase brush stroke" : "paint brush stroke"
    );
    this.initialSourceRect = getArtboardClipSourceRect(editor, node);
    this.preserveRasterPlane =
      editor.getNode(node.id)?.type === "image" && !this.initialSourceRect;
    this.commitReady = Promise.resolve();
    this.lastPoint = null;
    this.merged = false;
    this.nodeId = node.id;
    this.operation = operation;
    this.pointFlushFrameId = 0;
    this.pointReadIndex = 0;
    this.points = [];
    this.previewFrameId = 0;
    brushStrokeSessionRevision += 1;
    this.sessionId = `brush-session-${brushStrokeSessionRevision}`;
    this.previewNeedsNotify = false;
    this.previewNode = getImageNodeCroppedToSourceRect(
      node,
      this.initialSourceRect
    );
    this.settings = settings;
    this.storeEntry = editor.rasterStores.getOrCreateEntry(node.id);
    this.strokeStore = new RasterTileStore();
    recordRasterDebugEvent("session.create", {
      node: getRasterDebugNodePayload(node),
      operation,
      sessionId: this.sessionId,
      settings: {
        hardness: settings.hardness,
        opacity: settings.opacity,
        size: settings.size,
        spacing: settings.spacing,
      },
      sourceRect: this.initialSourceRect,
    });
    incrementPerfCounter("brush.tile.session");
    this.ready = editor.rasterStores.ensureHydrated(node);
    this.tool = tool;

    measurePerf("brush.stroke.materializeTarget", () =>
      editor.run(() => {
        materializeBrushTarget(editor, node);
      })
    );
    recordRasterDebugEvent("target.materialized", {
      node: getRasterDebugNodePayload(editor.getNode(this.nodeId)),
      sessionId: this.sessionId,
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
    if (!this.lastPoint) {
      this.applyDab(point);
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
      this.applyDab({
        x: this.lastPoint.x + (point.x - this.lastPoint.x) * progress,
        y: this.lastPoint.y + (point.y - this.lastPoint.y) * progress,
      });
    }

    incrementPerfCounter("brush.dab", steps);
    this.lastPoint = point;
  }

  applyDab(point) {
    const radius = this.settings.size / 2;
    const hardness = clamp(this.settings.hardness, 0, 1);
    const renderRadius = getBrushDabRenderRadius(this.settings.size, hardness);
    const bounds = {
      maxX: Math.ceil(point.x + renderRadius),
      maxY: Math.ceil(point.y + renderRadius),
      minX: Math.floor(point.x - renderRadius),
      minY: Math.floor(point.y - renderRadius),
    };

    this.strokeStore.paintDab({
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
      sessionId: this.sessionId,
    });
    this.addPoint(this.getLocalPoint(point));
    this.completed = true;
    this.cancelQueuedPointFlush();
    this.flushPoints();
    recordRasterDebugEvent("session.complete.flushed", {
      dirtyBounds: this.dirtyBounds,
      nodeId: this.nodeId,
      sessionId: this.sessionId,
    });
    this.commitReady = this.commit();

    return this.commitReady;
  }

  cancel() {
    this.cancelQueuedPointFlush();
    this.cancelLivePreview();
    this.editor.revertToMark(this.historyMark);
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
      sessionId: this.sessionId,
    });

    if (!this.dirtyBounds) {
      recordRasterDebugEvent("commit.noDirtyBounds", {
        nodeId: this.nodeId,
        sessionId: this.sessionId,
      });
      this.editor.revertToMark(this.historyMark);
      this.tool.clearActiveSession(this);
      return Promise.resolve();
    }

    return this.ready.then(() => this.finishCommit());
  }

  finishCommit() {
    const entry = this.storeEntry;

    measurePerf("brush.commit.mergeStrokeStore", () =>
      mergeStrokeStore({
        anchorX: entry.anchorX - (this.initialSourceRect?.x || 0),
        anchorY: entry.anchorY - (this.initialSourceRect?.y || 0),
        mode: this.operation === "erase" ? "erase" : "paint",
        store: entry.store,
        strokeStore: this.strokeStore,
      })
    );
    this.merged = true;
    this.tool.sessions.delete(this);
    this.editor.notifyInteractionPreviewChanged();

    if (this.operation === "erase") {
      return this.commitEraseFlatten();
    }

    return this.commitPaintTiles();
  }

  commitPaintTiles() {
    const paintedBounds = this.strokeStore.getPaintedBounds();
    const dirtyTiles = paintedBounds
      ? this.strokeStore.getTilesForBounds(paintedBounds, { create: false })
      : [];

    recordRasterDebugEvent("tileCommit.start", {
      dirtyTileCount: dirtyTiles.length,
      nodeId: this.nodeId,
      sessionId: this.sessionId,
    });

    if (dirtyTiles.length === 0) {
      this.editor.revertToMark(this.historyMark);
      this.tool.clearActiveSession(this);
      return Promise.resolve();
    }

    brushTileCommitRevision += 1;
    const commitRevision = brushTileCommitRevision;
    const shouldCommitAsync =
      canScheduleRasterFrame() &&
      dirtyTiles.length > BRUSH_TILE_ASYNC_COMMIT_THRESHOLD;

    if (shouldCommitAsync) {
      return this.commitTileSurfaceAsync({ commitRevision, dirtyTiles });
    }

    const tileSources = measurePerf("brush.tile.commit.encode", () =>
      dirtyTiles.flatMap((tile) => {
        const tileSource = createTileSourceFromDirtyTile({
          commitRevision,
          nodeId: this.nodeId,
          offsetX: this.initialSourceRect?.x || 0,
          offsetY: this.initialSourceRect?.y || 0,
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
              offsetX: this.initialSourceRect?.x || 0,
              offsetY: this.initialSourceRect?.y || 0,
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
          sessionId: this.sessionId,
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
        sessionId: this.sessionId,
      });
      this.editor.revertToMark(this.historyMark);
      this.tool.clearActiveSession(this);
      return;
    }

    let commitResult = null;

    measurePerf("brush.tile.commit.updateNode", () =>
      this.editor.run(() => {
        this.editor.getState().updateNodeById(this.nodeId, (node) => {
          if (node.type !== "image") {
            return node;
          }

          commitResult = getNextTiledImageNodeState({ node, tileSources });
          return commitResult.node;
        });
      })
    );

    if (commitResult) {
      this.storeEntry.anchorX += commitResult.offsetX;
      this.storeEntry.anchorY += commitResult.offsetY;
    }

    this.editor.commitHistoryStep(this.historyMark);
    recordRasterDebugEvent("tileCommit.finish", {
      committedNode: getRasterDebugNodePayload(
        commitResult?.node || this.editor.getNode(this.nodeId)
      ),
      encodedTileCount: tileSources.length,
      nodeId: this.nodeId,
      sessionId: this.sessionId,
    });
    this.completed = false;
    this.tool.clearActiveSession(this);
  }

  commitEraseFlatten() {
    const node = this.editor.getNode(this.nodeId);

    if (node?.type !== "image") {
      this.editor.revertToMark(this.historyMark);
      this.tool.clearActiveSession(this);
      return Promise.resolve();
    }

    const entry = this.storeEntry;
    const frameNode =
      !this.preserveRasterPlane && this.initialSourceRect
        ? getImageNodeCroppedToSourceRect(node, this.initialSourceRect)
        : node;
    const rect =
      !this.preserveRasterPlane && this.initialSourceRect
        ? this.initialSourceRect
        : { height: node.height, width: node.width, x: 0, y: 0 };
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const canvas = createCanvas(width, height);
    const context = canvas?.getContext("2d", { willReadFrequently: true });

    if (!(canvas && context)) {
      this.editor.revertToMark(this.historyMark);
      this.tool.clearActiveSession(this);
      return Promise.resolve();
    }

    measurePerf("brush.commit.flatten", () =>
      drawStoreTilesToCanvas({
        anchorX: entry.anchorX,
        anchorY: entry.anchorY,
        context,
        rect,
        store: entry.store,
      })
    );

    let output = {
      canvas,
      height,
      transform: frameNode.transform || {},
      trimX: 0,
      trimY: 0,
      width,
    };

    if (!this.preserveRasterPlane) {
      output =
        getTrimmedFlattenState({ canvas, context, frameNode }) || output;
    }

    const flattenOriginX = rect.x + output.trimX;
    const flattenOriginY = rect.y + output.trimY;

    const src = measurePerf("brush.commit.encode", () =>
      output.canvas.toDataURL("image/png")
    );

    measurePerf("brush.commit.updateNode", () =>
      this.editor.run(() => {
        this.editor.getState().updateNodeById(this.nodeId, (currentNode) => {
          if (currentNode.type !== "image") {
            return currentNode;
          }

          const { tileSources: _removedTileSources, ...nextNode } =
            currentNode;

          return {
            ...nextNode,
            baseHeight: output.height,
            baseWidth: output.width,
            baseX: 0,
            baseY: 0,
            height: output.height,
            mimeType: "image/png",
            src,
            transform: this.preserveRasterPlane
              ? currentNode.transform
              : {
                  ...currentNode.transform,
                  ...output.transform,
                },
            width: output.width,
          };
        });
      })
    );
    if (flattenOriginX || flattenOriginY) {
      entry.anchorX -= flattenOriginX;
      entry.anchorY -= flattenOriginY;
    }

    this.editor.commitHistoryStep(this.historyMark);
    recordRasterDebugEvent("commit.eraseFlatten.finish", {
      node: getRasterDebugNodePayload(this.editor.getNode(this.nodeId)),
      sessionId: this.sessionId,
    });
    this.completed = false;
    this.tool.clearActiveSession(this);
    return Promise.resolve();
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
    this.sessions = new Set();
  }

  getSettings() {
    const state = this.editor.getState();

    return (
      (this.operation === "erase"
        ? state.eraserSettings
        : state.brushSettings) || DEFAULT_BRUSH_SETTINGS
    );
  }

  getStrokeOverlaysForNode(nodeId) {
    const overlays = [];

    for (const session of this.sessions) {
      if (session.nodeId !== nodeId || session.merged) {
        continue;
      }

      overlays.push({
        operation: session.operation,
        revision: session.strokeStore.revision,
        strokeStore: session.strokeStore,
      });
    }

    return overlays;
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
      this.sessions.add(session);
      this.editor.notifyInteractionPreviewChanged();

      return session;
    });
  }

  clearActiveSession(session) {
    this.sessions.delete(session);

    if (this.activeSession === session) {
      this.activeSession = null;
      recordRasterDebugEvent("tool.clearActiveSession", {
        sessionId: session.sessionId,
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
