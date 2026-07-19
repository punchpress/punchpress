import { incrementPerfCounter, measurePerf } from "../perf/perf-hooks";
import {
  createStoreTileSource,
  getManifestEntryStoreKey,
  getReplacedTileSources,
  getStoreTileKey,
  getTiledImageCommitState,
  isPureTiledImageNode,
} from "../raster/raster-commit";
import {
  captureTileDeltasBeforeMerge,
  createStrokeCapture,
} from "../raster/raster-history";
import { scheduleRasterMemoryEnforcement } from "../raster/raster-memory";
import {
  commitMergedStrokeBounds,
  mergeStrokeStoreTile,
  RasterTileStore,
} from "../raster/raster-tile-store";
import {
  getBrushDabCoverage,
  getBrushDabRenderRadius,
  getBrushDabSpacing,
  getSolidBrushDabSpacing,
  getSolidBrushSegmentCoverage,
} from "./brush-mask";
import {
  cancelRasterFrame,
  canScheduleRasterFrame,
  getNow,
  hasRasterRuntime,
  requestRasterFrame,
} from "./brush-runtime";
import { DEFAULT_BRUSH_SETTINGS, getBrushColorRgb } from "./brush-settings";
import {
  getArtboardClipSourceRect,
  getImageLocalClipBounds,
  getImageLocalPoint,
  getImageLocalViewportBounds,
  getImageNodeCroppedToSourceRect,
  materializeBrushTarget,
  resolveBrushTarget,
} from "./brush-target";
import { selectToolFromShortcut, Tool } from "./tool";

// Per-rAF dab budget for the queued-point drain. The drain shares its frame
// with the compositor repaint (~10ms on a dense huge layer), so the budget
// must leave a 30fps frame with headroom; queued points absorb the slack and
// complete() drains whatever remains at pointerup.
const BRUSH_STROKE_POINT_FLUSH_BUDGET_MS = 11;
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

const yieldRasterTask = () =>
  new Promise((resolve) => {
    if (typeof setTimeout === "undefined") {
      resolve(undefined);
      return;
    }

    setTimeout(resolve, 0);
  });

/**
 * Frame-cadenced yield for background commit work (merge + encode chunks).
 * rAF, never a microtask/timeout loop, so each chunk shares its frame with
 * input handling and the compositor instead of starving them.
 */
const nextRasterFrame = () =>
  new Promise((resolve) => {
    requestRasterFrame(() => resolve(undefined));
  });

class BrushStrokeSession {
  constructor({ editor, node, operation, settings, startPoint, tool }) {
    this.completed = false;
    this.dirtyBounds = null;
    this.editor = editor;
    this.historyMark = editor.markHistoryStep(
      operation === "erase" ? "erase brush stroke" : "paint brush stroke"
    );
    this.initialSourceRect = getArtboardClipSourceRect(editor, node);

    const localClipBounds = getImageLocalClipBounds(editor, node);

    this.strokeClipBounds = localClipBounds
      ? {
          maxX: localClipBounds.maxX - (this.initialSourceRect?.x || 0),
          maxY: localClipBounds.maxY - (this.initialSourceRect?.y || 0),
          minX: localClipBounds.minX - (this.initialSourceRect?.x || 0),
          minY: localClipBounds.minY - (this.initialSourceRect?.y || 0),
        }
      : null;
    this.createdTarget = editor.getNode(node.id)?.type !== "image";
    this.preserveRasterPlane =
      editor.getNode(node.id)?.type === "image" && !this.initialSourceRect;
    this.activeSegment = null;
    this.commitReady = Promise.resolve();
    this.historyCapture = null;
    this.lastPoint = null;
    this.lastSolidDab = null;
    this.merged = false;
    this.mergedStoreBounds = null;
    this.mergedStoreTiles = new Set();
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
    // Solid strokes (fully-hard, fully-opaque paint) take the capsule fast
    // path: each dab paints the exact envelope segment from the previous dab
    // point, so the dab step can stretch (getSolidBrushDabSpacing) without
    // scalloping edges. Explicit wide spacing keeps stamped circles.
    this.solidStroke =
      operation === "paint" &&
      clamp(settings.hardness, 0, 1) >= 1 &&
      settings.opacity >= 1;
    this.capsuleStroke =
      this.solidStroke &&
      getBrushDabSpacing(settings.size, settings.spacing, 1) <=
        settings.size / 4;
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
    this.ready = editor.rasterStores.ensureHydrated(node, {
      priorityBounds: getImageLocalViewportBounds(editor, node),
    });
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

  /**
   * Input path does no dab work during an active stroke: points enqueue and
   * the rAF-cadenced flush owns ALL dab application under its frame budget
   * (complete() drains the remainder). Budgeting the input flush itself and
   * stacking an rAF drain on top regressed frame pacing badly — per-frame
   * budget+drain churn compounds — so pointer events must stay write-only.
   */
  addPoint(point) {
    this.points.push(point);
    this.scheduleQueuedPointFlush();
  }

  flushPoints({
    budgetMs = Number.POSITIVE_INFINITY,
  } = {}) {
    measurePerf("brush.stroke.flushPoints", () => {
      const deadline = Number.isFinite(budgetMs)
        ? getNow() + budgetMs
        : Number.POSITIVE_INFINITY;
      let processedCount = 0;

      while (true) {
        if (this.activeSegment && !this.advanceSegment(deadline)) {
          break;
        }

        this.activeSegment = null;

        if (this.pointReadIndex >= this.points.length) {
          break;
        }

        const point = this.points[this.pointReadIndex];

        this.pointReadIndex += 1;
        this.beginSegment(point);
        processedCount += 1;
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

  get hasPendingStrokeInput() {
    return Boolean(this.activeSegment) || this.pointReadIndex < this.points.length;
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

      if (!this.completed && this.hasPendingStrokeInput) {
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

  beginSegment(point) {
    if (!this.lastPoint) {
      this.applyDab(point);
      incrementPerfCounter("brush.dab");
      this.lastPoint = point;
      this.activeSegment = null;
      return;
    }

    const distance = Math.hypot(
      point.x - this.lastPoint.x,
      point.y - this.lastPoint.y
    );
    const spacing = this.capsuleStroke
      ? getSolidBrushDabSpacing(this.settings.size, this.settings.spacing)
      : getBrushDabSpacing(
          this.settings.size,
          this.settings.spacing,
          this.settings.hardness
        );

    this.activeSegment = {
      from: this.lastPoint,
      index: 0,
      steps: Math.max(1, Math.ceil(distance / spacing)),
      to: point,
    };
    this.lastPoint = point;
  }

  advanceSegment(deadline) {
    const segment = this.activeSegment;
    const pointAt = (progress) => ({
      x: segment.from.x + (segment.to.x - segment.from.x) * progress,
      y: segment.from.y + (segment.to.y - segment.from.y) * progress,
    });
    let appliedCount = 0;

    while (segment.index < segment.steps) {
      if (getNow() >= deadline) {
        incrementPerfCounter("brush.dab", appliedCount);
        return false;
      }

      segment.index += 1;
      this.applyDab(
        pointAt(segment.index / segment.steps),
        pointAt((segment.index - 1) / segment.steps)
      );
      appliedCount += 1;
    }

    incrementPerfCounter("brush.dab", appliedCount);
    return true;
  }

  applyDab(point, segmentFrom = null) {
    const radius = this.settings.size / 2;
    const hardness = clamp(this.settings.hardness, 0, 1);
    const renderRadius = getBrushDabRenderRadius(this.settings.size, hardness);
    const capsuleFrom = this.capsuleStroke && segmentFrom ? segmentFrom : null;
    const bounds = {
      maxX: Math.ceil(Math.max(point.x, capsuleFrom?.x ?? point.x) + renderRadius),
      maxY: Math.ceil(Math.max(point.y, capsuleFrom?.y ?? point.y) + renderRadius),
      minX: Math.floor(Math.min(point.x, capsuleFrom?.x ?? point.x) - renderRadius),
      minY: Math.floor(Math.min(point.y, capsuleFrom?.y ?? point.y) - renderRadius),
    };

    if (this.strokeClipBounds) {
      bounds.maxX = Math.min(
        bounds.maxX,
        Math.ceil(this.strokeClipBounds.maxX) - 1
      );
      bounds.maxY = Math.min(
        bounds.maxY,
        Math.ceil(this.strokeClipBounds.maxY) - 1
      );
      bounds.minX = Math.max(
        bounds.minX,
        Math.floor(this.strokeClipBounds.minX)
      );
      bounds.minY = Math.max(
        bounds.minY,
        Math.floor(this.strokeClipBounds.minY)
      );

      if (bounds.maxX <= bounds.minX || bounds.maxY <= bounds.minY) {
        return;
      }
    }

    // For a solid stroke the previous dab painted an identical saturated
    // capsule/circle, so the store can skip rewriting the overlap and fill
    // only the new crescent.
    const solid = this.solidStroke
      ? {
          from: capsuleFrom || undefined,
          radius,
          skip: this.lastSolidDab ? { radius, ...this.lastSolidDab } : undefined,
        }
      : undefined;

    this.strokeStore.paintDab({
      bounds,
      color: getBrushColorRgb(this.settings.color),
      getCoverage: capsuleFrom
        ? (x, y) =>
            getSolidBrushSegmentCoverage(x, y, capsuleFrom, point, radius)
        : (x, y, centerPoint) => {
            const dx = x - centerPoint.x;
            const dy = y - centerPoint.y;
            const normalizedDistanceSquared =
              (dx * dx + dy * dy) / (radius * radius);

            return getBrushDabCoverage(
              normalizedDistanceSquared,
              hardness,
              radius
            );
          },
      opacity: this.settings.opacity,
      point,
      solid,
    });

    if (solid) {
      this.lastSolidDab = capsuleFrom
        ? { from: capsuleFrom, x: point.x, y: point.y }
        : { x: point.x, y: point.y };
    }

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
    this.points.push(this.getLocalPoint(point));
    this.completed = true;
    this.cancelQueuedPointFlush();
    this.commitReady = this.commit();

    return this.commitReady;
  }

  async flushRemainingPoints() {
    while (this.hasPendingStrokeInput) {
      this.flushPoints({
        budgetMs: canScheduleRasterFrame()
          ? BRUSH_STROKE_POINT_FLUSH_BUDGET_MS
          : Number.POSITIVE_INFINITY,
      });
      this.editor.notifyInteractionPreviewChanged();

      if (this.hasPendingStrokeInput) {
        await yieldRasterTask();
      }
    }

    recordRasterDebugEvent("session.complete.flushed", {
      dirtyBounds: this.dirtyBounds,
      nodeId: this.nodeId,
      sessionId: this.sessionId,
    });
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

    return this.runCommit();
  }

  async runCommit() {
    await this.flushRemainingPoints();

    if (!this.dirtyBounds) {
      recordRasterDebugEvent("commit.noDirtyBounds", {
        nodeId: this.nodeId,
        sessionId: this.sessionId,
      });
      this.editor.revertToMark(this.historyMark);
      this.tool.clearActiveSession(this);
      return;
    }

    // Merge does NOT await full hydration: it hydrates exactly the store
    // tiles the stroke touches (inside mergeStrokeStoreBudgeted) while the
    // background hydration kicked at session start keeps streaming the rest.

    // Commits serialize per node: encode reads merged store tiles, so a
    // later session's merge must never interleave with an earlier session's
    // encode chunks on the same store.
    const entry = this.storeEntry;

    entry.pendingCommits += 1;

    const commitRun = entry.commitQueue.then(() => this.finishCommit());
    const settled = commitRun.then(
      () => {
        entry.pendingCommits -= 1;
      },
      () => {
        entry.pendingCommits -= 1;
      }
    );

    entry.commitQueue = settled;
    await commitRun;
  }

  async finishCommit() {
    await this.mergeStrokeStoreBudgeted();
    this.merged = true;
    this.tool.sessions.delete(this);
    this.editor.notifyInteractionPreviewChanged();

    return this.commitStoreTiles();
  }

  async mergeStrokeStoreBudgeted() {
    const entry = this.storeEntry;
    const strokeBounds = this.strokeStore.getPaintedBounds();

    if (!strokeBounds) {
      return;
    }

    const anchorX = entry.anchorX - (this.initialSourceRect?.x || 0);
    const anchorY = entry.anchorY - (this.initialSourceRect?.y || 0);
    const mode = this.operation === "erase" ? "erase" : "paint";
    const strokeTiles = this.strokeStore.getTilesForBounds(strokeBounds, {
      create: false,
    });
    let tileIndex = 0;

    // Hydrate exactly the store tiles this merge will write (cold tiles
    // decode from their manifest payloads; blank regions cost nothing).
    // This must complete before the capture below copies before-rects —
    // undo restores HYDRATED content, never a cold tile's zeros — and
    // before erase merges reduce alpha against real pixels.
    const node = this.editor.getNode(this.nodeId);

    if (node?.type === "image") {
      await this.editor.rasterStores.ensureTilesHydrated(node, {
        maxX: strokeBounds.maxX - anchorX,
        maxY: strokeBounds.maxY - anchorY,
        minX: strokeBounds.minX - anchorX,
        minY: strokeBounds.minY - anchorY,
      });
    }

    // Tile-delta history: the merge below is the only writer of committed
    // store pixels, so each target tile's about-to-be-written sub-rect is
    // copied here, before its first write in this commit.
    this.historyCapture = createStrokeCapture({
      anchorBefore: { x: entry.anchorX, y: entry.anchorY },
      mergeAnchorX: anchorX,
      mergeAnchorY: anchorY,
      operation: this.operation === "erase" ? "erase" : "paint",
    });

    while (tileIndex < strokeTiles.length) {
      // A previous stroke's merge must never land under the next stroke's
      // drag: pause whole chunks while any session is interactively painting.
      if (canScheduleRasterFrame() && this.tool.hasInteractiveStrokeWork()) {
        await nextRasterFrame();
        continue;
      }

      measurePerf("brush.commit.mergeStrokeStore.chunk", () => {
        const startedAt = getNow();

        do {
          const strokeTile = strokeTiles[tileIndex];

          captureTileDeltasBeforeMerge({
            anchorX,
            anchorY,
            capture: this.historyCapture,
            store: entry.store,
            strokeTile,
          });

          for (const touchedTile of mergeStrokeStoreTile({
            anchorX,
            anchorY,
            mode,
            store: entry.store,
            strokeTile,
          })) {
            this.mergedStoreTiles.add(touchedTile);
          }

          strokeTile.merged = true;
          tileIndex += 1;
        } while (
          tileIndex < strokeTiles.length &&
          getNow() - startedAt < BRUSH_TILE_COMMIT_BUDGET_MS
        );
      });

      if (tileIndex < strokeTiles.length && canScheduleRasterFrame()) {
        await nextRasterFrame();
      }
    }

    this.strokeStore.revision += 1;
    this.mergedStoreBounds = commitMergedStrokeBounds({
      anchorX,
      anchorY,
      store: entry.store,
      strokeBounds,
    });
  }

  /**
   * Store-backed commit projection. The store (fully hydrated and merged) is
   * complete truth here, so every commit leaves the node pure-tiled: on the
   * node's first store commit — or whenever its manifest is not in the
   * pure-tiled shape (imported src, legacy append overlays, a reloaded
   * manifest whose grid drifted off this session's store tiling) — every
   * non-blank store tile re-encodes once, the manifest is rebuilt keyed by
   * store tile, and `src`/base fields drop. Pure nodes re-encode only the
   * tiles this commit's merge touched and swap the matching entries, so
   * manifest size is bounded by painted area, never stroke count. Erase and
   * artboard-clipped commits ride the same path (a clip commit crops the
   * node to the source rect and migrates within it); the old single-payload
   * flatten shape is gone.
   */
  async commitStoreTiles() {
    const node = this.editor.getNode(this.nodeId);

    if (node?.type !== "image") {
      this.editor.revertToMark(this.historyMark);
      this.tool.clearActiveSession(this);
      return;
    }

    const entry = this.storeEntry;
    const sourceRect =
      !this.preserveRasterPlane && this.initialSourceRect
        ? this.initialSourceRect
        : null;
    // Manifest coords land in the committed node's plane; a crop commit
    // rebases the node to the source rect, shifting the effective anchor.
    const anchorX = entry.anchorX - (sourceRect?.x || 0);
    const anchorY = entry.anchorY - (sourceRect?.y || 0);
    const pure =
      !sourceRect &&
      isPureTiledImageNode(node, {
        anchorX: entry.anchorX,
        anchorY: entry.anchorY,
      });

    // A migration commit re-encodes every non-blank store tile, so the
    // store must be complete truth first. Pure commits skip this: they only
    // read tiles the merge just touched (and hydrated).
    if (!pure) {
      await this.editor.rasterStores.ensureHydrated(node);
    }

    const clampBounds = this.getCommitClampBounds(node, sourceRect);
    const dirtyTiles = pure
      ? [...this.mergedStoreTiles]
      : clampBounds
        ? entry.store.getTilesForBounds(clampBounds, { create: false })
        : [];
    const replacedKeys = new Set(
      pure
        ? dirtyTiles.map((tile) => getStoreTileKey(tile.col, tile.row))
        : []
    );

    recordRasterDebugEvent("tileCommit.start", {
      dirtyTileCount: dirtyTiles.length,
      migration: !pure,
      nodeId: this.nodeId,
      sessionId: this.sessionId,
    });

    brushTileCommitRevision += 1;
    const commitRevision = brushTileCommitRevision;
    const encodeContext = {
      anchorX,
      anchorY,
      clampBounds,
      commitRevision,
      dirtyTiles,
    };
    const finish = (tileSources) =>
      this.finishStoreTileCommit({
        anchorX,
        anchorY,
        pure,
        replacedKeys,
        sourceRect,
        tileSources,
      });
    const shouldCommitAsync =
      canScheduleRasterFrame() &&
      dirtyTiles.length > BRUSH_TILE_ASYNC_COMMIT_THRESHOLD;

    if (shouldCommitAsync) {
      finish(await this.encodeStoreTilesAsync(encodeContext));
      return;
    }

    const tileSources = measurePerf("brush.tile.commit.encode", () =>
      dirtyTiles.flatMap((tile) => {
        const tileSource = this.encodeStoreTile(encodeContext, tile);

        return tileSource ? [tileSource] : [];
      })
    );

    finish(tileSources);
  }

  /**
   * The node's legitimate plane region in store coordinates: the node rect
   * plus this commit's merged stroke bounds — or the artboard source rect
   * for crop commits. Encoding clamps to it so store pixels that committed
   * state has dropped (an earlier artboard crop) never resurface in a
   * manifest.
   */
  getCommitClampBounds(node, sourceRect) {
    const entry = this.storeEntry;

    if (sourceRect) {
      return {
        maxX: sourceRect.x + sourceRect.width - entry.anchorX,
        maxY: sourceRect.y + sourceRect.height - entry.anchorY,
        minX: sourceRect.x - entry.anchorX,
        minY: sourceRect.y - entry.anchorY,
      };
    }

    const planeBounds = {
      maxX: node.width - entry.anchorX,
      maxY: node.height - entry.anchorY,
      minX: -entry.anchorX,
      minY: -entry.anchorY,
    };

    if (!this.mergedStoreBounds) {
      return planeBounds;
    }

    return {
      maxX: Math.max(planeBounds.maxX, this.mergedStoreBounds.maxX),
      maxY: Math.max(planeBounds.maxY, this.mergedStoreBounds.maxY),
      minX: Math.min(planeBounds.minX, this.mergedStoreBounds.minX),
      minY: Math.min(planeBounds.minY, this.mergedStoreBounds.minY),
    };
  }

  encodeStoreTile({ anchorX, anchorY, clampBounds, commitRevision }, tile) {
    return createStoreTileSource({
      anchorX,
      anchorY,
      assets: this.editor.rasterAssets,
      clampBounds,
      commitRevision,
      nodeId: this.nodeId,
      tile,
    });
  }

  async encodeStoreTilesAsync(encodeContext) {
    const { dirtyTiles } = encodeContext;
    const tileSources = [];
    let tileIndex = 0;

    while (tileIndex < dirtyTiles.length) {
      // Encode follows the merge rule: pause whole chunks while any session
      // is interactively painting, resume on rAF cadence when idle.
      if (canScheduleRasterFrame() && this.tool.hasInteractiveStrokeWork()) {
        await nextRasterFrame();
        continue;
      }

      measurePerf("brush.tile.commit.encode.chunk", () => {
        const startedAt = getNow();

        while (tileIndex < dirtyTiles.length) {
          const tileSource = this.encodeStoreTile(
            encodeContext,
            dirtyTiles[tileIndex]
          );

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

      if (tileIndex < dirtyTiles.length && canScheduleRasterFrame()) {
        await nextRasterFrame();
      }
    }

    recordRasterDebugEvent("tileCommit.asyncEncoded", {
      commitRevision: encodeContext.commitRevision,
      encodedTileCount: tileSources.length,
      nodeId: this.nodeId,
      sessionId: this.sessionId,
    });
    return tileSources;
  }

  finishStoreTileCommit({
    anchorX,
    anchorY,
    pure,
    replacedKeys,
    sourceRect,
    tileSources,
  }) {
    const entry = this.storeEntry;

    if (tileSources.length === 0 && this.isNoOpCommit({ pure, replacedKeys })) {
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

          const nextTileSources = pure
            ? getReplacedTileSources({
                anchorX: entry.anchorX,
                anchorY: entry.anchorY,
                existingTileSources: node.tileSources || [],
                replacedKeys,
                tileSources,
              })
            : tileSources;

          commitResult = getTiledImageCommitState({
            node: sourceRect
              ? getImageNodeCroppedToSourceRect(node, sourceRect)
              : node,
            tileSources: nextTileSources,
            trimToTiles: this.createdTarget,
          });
          return commitResult.node;
        });
      })
    );

    if (commitResult) {
      entry.anchorX = anchorX + commitResult.offsetX;
      entry.anchorY = anchorY + commitResult.offsetY;
    }

    this.recordRasterHistoryStep(
      this.editor.commitHistoryStep(this.historyMark)
    );
    // The merge (and any migration hydration) may have carried decoded
    // bytes past the hot-tile budget while this store was pinned; trim now
    // that the commit has settled.
    scheduleRasterMemoryEnforcement();
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

  /**
   * A commit that encoded nothing is a no-op only when it also removes
   * nothing: a pure commit whose replaced keys match no existing entry
   * (painting produced no visible pixels), or a brand-new layer that never
   * got visible paint. Erase-to-empty and migrations of blank nodes still
   * commit — they change the manifest.
   */
  isNoOpCommit({ pure, replacedKeys }) {
    if (this.createdTarget) {
      return true;
    }

    if (!pure) {
      return false;
    }

    const entry = this.storeEntry;
    const node = this.editor.getNode(this.nodeId);

    return !(node?.tileSources || []).some((tileSource) =>
      replacedKeys.has(
        getManifestEntryStoreKey(tileSource, entry.anchorX, entry.anchorY)
      )
    );
  }

  /**
   * Hand the stroke's tile deltas and stroke buffer to the editor's raster
   * history once the document history step committed. Keyed by the unique id
   * the HistoryManager stamped on the pushed change; skipped when the commit
   * did not push (mark released by an interleaved undo, or a no-op diff).
   */
  recordRasterHistoryStep(committed) {
    if (!(committed && this.historyCapture)) {
      this.historyCapture = null;
      return;
    }

    this.editor.rasterHistory.record({
      anchorAfter: { x: this.storeEntry.anchorX, y: this.storeEntry.anchorY },
      capture: this.historyCapture,
      historyStepId: this.editor.history.lastPushedChangeId,
      nodeId: this.nodeId,
      strokeStore: this.strokeStore,
    });
    this.historyCapture = null;
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

  /**
   * True while any of this tool's sessions has an active pointer stroke or
   * un-flushed stroke points. Background commit work (merge + encode chunks)
   * pauses while this holds so it never runs under a live drag.
   */
  hasInteractiveStrokeWork() {
    for (const session of this.sessions) {
      if (!session.completed || session.hasPendingStrokeInput) {
        return true;
      }
    }

    return false;
  }

  /**
   * True while a session targeting the node has an unmerged stroke buffer.
   * The hot-tile budget never evicts such a node's store tiles: the pending
   * merge composites against them.
   */
  hasUnmergedSessionForNode(nodeId) {
    for (const session of this.sessions) {
      if (session.nodeId === nodeId && !session.merged) {
        return true;
      }
    }

    return false;
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
