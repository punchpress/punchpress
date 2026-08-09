import { getImageNodeBounds } from "../nodes/image/image-capabilities";
import { measurePerf } from "../perf/perf-hooks";
import { PERF_SPANS } from "../perf/perf-labels";
import type {
  RasterHistoryPatch,
  RasterOperation,
  RasterPoint,
  RasterStrokeSettings,
  RasterTarget,
} from "../raster/contracts";
import { getRasterStrokeReach } from "../raster/settings";
import {
  clipRasterSegmentToTarget,
  createRasterStroke,
} from "../raster/stroke";
import {
  getNodeTransformForPinnedWorldPoint,
  getNodeWorldPoint,
} from "../primitives/rotation";
import {
  getImageLocalPoint,
  getRasterTargetState,
  getRasterSurfaceBounds,
  getRasterSurfacePixelSize,
  getRasterWritableBounds,
  getRasterWritablePolygon,
  materializeBrushTarget,
  resolveBrushTargetState,
} from "./brush-target";

export type RasterStrokeRuntimeSession = {
  readonly preservePointerSamples?: boolean;
  readonly ready?: Promise<unknown>;
  cancel: () => void;
  complete: (input: { point: RasterPoint }) => Promise<unknown> | unknown;
  update: (input: { point: RasterPoint }) => void;
};

type BeginRasterStrokeInput = {
  operation: RasterOperation;
  point: RasterPoint;
  settings: RasterStrokeSettings;
};

type ManagedRasterStrokeSession = RasterStrokeRuntimeSession & {
  readonly requiresFiniteInputClipping?: boolean;
  completeCurrent?: () => Promise<unknown> | unknown;
  getCommittedDocumentNodes?: () => readonly any[];
  getPresentationViewport?: () => {
    bounds: RasterTarget["bounds"];
    clipBounds: readonly RasterTarget["bounds"][];
    targetId: string;
  } | null;
  restart?: (input: { point: RasterPoint }) => void;
  updateBatch?: (inputs: readonly { point: RasterPoint }[]) => void;
};

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

const getRasterStrokeTarget = (editor, node): RasterTarget => {
  const writableBounds = getRasterWritableBounds(editor, node);
  const writablePolygon = getRasterWritablePolygon(editor, node);
  const sourceBounds = {
    height: node.baseHeight ?? node.height,
    width: node.baseWidth ?? node.width,
    x: node.baseX ?? 0,
    y: node.baseY ?? 0,
  };
  const resolvedSurfaceGeometry = editor.rasterSurface?.getSurfaceGeometry?.(
    node.id,
    sourceBounds
  );
  const surfaceGeometry =
    resolvedSurfaceGeometry &&
    (!writableBounds ||
      containsRasterBounds(resolvedSurfaceGeometry.bounds, writableBounds))
      ? resolvedSurfaceGeometry
      : null;
  const bounds =
    surfaceGeometry?.bounds ?? getRasterSurfaceBounds(editor, node) ?? sourceBounds;

  return {
    bounds,
    id: node.id,
    pixelSize:
      surfaceGeometry?.pixelSize ??
      getRasterSurfacePixelSize(editor, node) ?? {
        height: Math.max(1, Math.ceil(bounds.height)),
        width: Math.max(1, Math.ceil(bounds.width)),
      },
    ...(writableBounds ? { writableBounds } : {}),
    ...(writablePolygon ? { writablePolygon } : {}),
  };
};

const containsRasterBounds = (outer, inner) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

const unionRasterBounds = (first, second) => {
  const x = Math.min(first.x, second.x);
  const y = Math.min(first.y, second.y);
  const maxX = Math.max(first.x + first.width, second.x + second.width);
  const maxY = Math.max(first.y + first.height, second.y + second.height);

  return { height: maxY - y, width: maxX - x, x, y };
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

class StableRasterStrokeSession implements ManagedRasterStrokeSession {
  readonly requiresFiniteInputClipping = true;
  readonly preservePointerSamples = true;
  readonly ready: Promise<unknown>;
  private cancelled = false;
  private committedDocumentNodes: readonly any[];
  private completed = false;
  private completionPoint: RasterPoint | null = null;
  private historyMark: unknown;
  private node: any;
  private operation: RasterOperation;
  private pendingPoints: RasterPoint[];
  private presentationDirtyBounds: RasterTarget["bounds"] | null = null;
  private settings: RasterStrokeSettings;
  private stroke: ReturnType<typeof createRasterStroke> | null = null;
  private target: RasterTarget;
  private tool: RasterStrokeRuntime;

  constructor({ node, operation, point, settings, tool }) {
    this.committedDocumentNodes = tool.editor.nodes;
    this.node = node;
    this.operation = operation;
    this.pendingPoints = [point];
    this.settings = settings;
    this.tool = tool;
    this.historyMark = tool.editor.markHistoryStep(
      operation === "erase" ? "erase brush stroke" : "paint brush stroke"
    );

    tool.editor.run(() => {
      materializeBrushTarget(tool.editor, node);
    });
    this.node = tool.editor.getNode(node.id) || node;
    this.target = getRasterStrokeTarget(tool.editor, this.node);
    this.includePresentationPoint(point);
    this.ready = this.prepare().catch((error) => {
      if (!this.cancelled) {
        this.cancelled = true;
        this.pendingPoints = [];
        this.tool.editor.revertToMark(this.historyMark);
        this.tool.clearActiveSession(this);
      }

      throw error;
    });
  }

  update({ point }: { point: RasterPoint }) {
    if (this.cancelled || this.completed) {
      return;
    }

    this.includePresentationPoint(point);
    if (this.stroke) {
      this.stroke.append([getImageLocalPoint(this.node, point)]);
      return;
    }

    this.pendingPoints.push(point);
  }

  updateBatch(inputs: readonly { point: RasterPoint }[]) {
    if (this.cancelled || this.completed || inputs.length === 0) {
      return;
    }

    const points = inputs.map(({ point }) => point);

    for (const point of points) {
      this.includePresentationPoint(point);
    }
    if (this.stroke) {
      this.stroke.append(points.map((point) => getImageLocalPoint(this.node, point)));
      return;
    }

    this.pendingPoints.push(...points);
  }

  restart({ point }: { point: RasterPoint }) {
    this.update({ point });
  }

  complete({ point }: { point: RasterPoint }) {
    if (this.completed) {
      return this.ready;
    }

    this.completed = true;
    this.completionPoint = point;
    return this.ready.then(() => this.commitPreparedStroke());
  }

  completeCurrent() {
    if (this.completed) {
      return this.ready;
    }

    this.completed = true;
    return this.ready.then(() => this.commitPreparedStroke());
  }

  getPresentationViewport() {
    const committedBounds = {
      height: this.node.height,
      width: this.node.width,
      x: 0,
      y: 0,
    };

    return {
      bounds: this.target.bounds,
      clipBounds: [
        committedBounds,
        ...(this.presentationDirtyBounds ? [this.presentationDirtyBounds] : []),
      ],
      targetId: this.node.id,
    };
  }

  getCommittedDocumentNodes() {
    return this.committedDocumentNodes;
  }

  cancel() {
    if (this.cancelled || this.completed) {
      return;
    }

    this.cancelled = true;
    this.pendingPoints = [];
    this.stroke?.cancel();
    this.tool.editor.revertToMark(this.historyMark);
    this.tool.clearActiveSession(this);
  }

  private async prepare() {
    let target = this.target;
    const runtime = this.tool.editor.rasterSurface;
    let surface = runtime?.resolveSurface?.(target);

    if (!surface && runtime?.ensureSurface) {
      await runtime.ensureSurface({
        authoritative: true,
        bounds: target.bounds,
        height: target.pixelSize.height,
        id: this.node.id,
        sourceBounds: {
          height: this.node.baseHeight ?? this.node.height,
          width: this.node.baseWidth ?? this.node.width,
          x: this.node.baseX ?? 0,
          y: this.node.baseY ?? 0,
        },
        src: this.node.src,
        width: target.pixelSize.width,
      });
      target = getRasterStrokeTarget(this.tool.editor, this.node);
      this.target = target;
      surface = runtime.resolveSurface?.(target);
    }

    if (this.cancelled) {
      return;
    }

    if (!surface) {
      this.tool.editor.revertToMark(this.historyMark);
      this.cancelled = true;
      this.tool.clearActiveSession(this);
      throw new Error(`Raster ${this.node.id} has no resident Canvas surface.`);
    }

    const [firstPoint, ...remainingPoints] = this.pendingPoints;

    if (!firstPoint) {
      return;
    }

    this.stroke = measurePerf(PERF_SPANS.rasterStrokeBegin, () =>
      createRasterStroke({
        operation: this.operation,
        point: getImageLocalPoint(this.node, firstPoint),
        settings: this.settings,
        surface,
        target,
      })
    );
    this.pendingPoints = [];

    if (remainingPoints.length > 0) {
      this.stroke.append(
        remainingPoints.map((point) => getImageLocalPoint(this.node, point))
      );
    }
  }

  private includePresentationPoint(point: RasterPoint) {
    const localPoint = getImageLocalPoint(this.node, point);
    const radius = getRasterStrokeReach(this.settings);
    const bounds = this.target.writableBounds ?? this.target.bounds;
    const minX = Math.max(bounds.x, localPoint.x - radius);
    const minY = Math.max(bounds.y, localPoint.y - radius);
    const maxX = Math.min(bounds.x + bounds.width, localPoint.x + radius);
    const maxY = Math.min(bounds.y + bounds.height, localPoint.y + radius);

    if (maxX <= minX || maxY <= minY) {
      return;
    }

    const pointBounds = {
      height: maxY - minY,
      width: maxX - minX,
      x: minX,
      y: minY,
    };
    const nextBounds = this.presentationDirtyBounds
      ? unionRasterBounds(this.presentationDirtyBounds, pointBounds)
      : pointBounds;

    if (
      this.presentationDirtyBounds &&
      nextBounds.x === this.presentationDirtyBounds.x &&
      nextBounds.y === this.presentationDirtyBounds.y &&
      nextBounds.width === this.presentationDirtyBounds.width &&
      nextBounds.height === this.presentationDirtyBounds.height
    ) {
      return;
    }

    this.presentationDirtyBounds = nextBounds;
    this.tool.editor.notifyInteractionPreviewChanged();
  }

  private commitPreparedStroke() {
    if (this.cancelled || !this.stroke) {
      return null;
    }

    if (this.completionPoint) {
      this.stroke.append([getImageLocalPoint(this.node, this.completionPoint)]);
    }

    const commit = measurePerf(PERF_SPANS.rasterStrokePointerRelease, () =>
      this.stroke?.commit()
    );

    if (!commit) {
      return null;
    }

    const rebase =
      this.operation === "paint"
        ? expandFrameRasterToDirtyRegion(
            this.tool.editor,
            this.node,
            this.target,
            commit.dirtyRegion
          )
        : null;
    const patch = composeRasterHistoryPatch(commit.patch, rebase);

    this.tool.editor.commitHistoryStep(this.historyMark, patch);
    this.tool.clearActiveSession(this);
    return commit;
  }
}

class DeferredRasterStrokeSession implements ManagedRasterStrokeSession {
  readonly preservePointerSamples = true;
  delegate: ManagedRasterStrokeSession | null = null;
  private delegateDisconnected = false;
  private lastDelegatePoint: RasterPoint | null = null;
  private operation: RasterOperation;
  private previousPoint: RasterPoint;
  private projection: ReturnType<typeof getLockedTargetProjection>;
  private settings: RasterStrokeSettings;
  private targetState: any;
  private tool: RasterStrokeRuntime;

  constructor({ operation, point, settings, targetState, tool }) {
    this.operation = operation;
    this.previousPoint = point;
    this.projection = getLockedTargetProjection(tool.editor, targetState);
    this.settings = settings;
    this.targetState = targetState;
    this.tool = tool;
    this.activate(point, point);
  }

  get ready() {
    return this.delegate?.ready || Promise.resolve();
  }

  getPresentationViewport() {
    return this.delegate?.getPresentationViewport?.() ?? null;
  }

  getCommittedDocumentNodes() {
    return this.delegate?.getCommittedDocumentNodes?.() ?? this.tool.editor.nodes;
  }

  update({ point }: { point: RasterPoint }) {
    if (this.delegate) {
      this.forwardClippedSegment(this.previousPoint, point);
    } else {
      this.activate(this.previousPoint, point);
    }
    this.previousPoint = point;
  }

  updateBatch(inputs: readonly { point: RasterPoint }[]) {
    if (inputs.length === 0) {
      return;
    }

    let firstUnforwardedIndex = 0;

    while (!this.delegate && firstUnforwardedIndex < inputs.length) {
      this.update(inputs[firstUnforwardedIndex]);
      firstUnforwardedIndex += 1;
    }

    const remaining = inputs.slice(firstUnforwardedIndex);

    if (remaining.length > 0) {
      if (this.delegate?.updateBatch) {
        this.delegate.updateBatch(remaining);
      } else {
        for (const input of remaining) {
          this.delegate?.update(input);
        }
      }

      const lastPoint = remaining.at(-1)?.point;

      if (lastPoint) {
        this.previousPoint = lastPoint;
        this.lastDelegatePoint = lastPoint;
        this.delegateDisconnected = !this.getClippedWorldSegment(
          lastPoint,
          lastPoint
        );
      }
    }
  }

  complete({ point }: { point: RasterPoint }) {
    if (this.delegate) {
      this.forwardClippedSegment(this.previousPoint, point);
      this.previousPoint = point;
      return this.delegate.completeCurrent?.() || this.delegate.complete({ point });
    }

    this.activate(this.previousPoint, point);
    this.previousPoint = point;

    if (this.delegate) {
      return this.delegate.completeCurrent?.() || this.delegate.complete({ point });
    }

    this.tool.clearActiveSession(this);
    return Promise.resolve();
  }

  cancel() {
    this.delegate?.cancel();
    this.tool.clearActiveSession(this);
  }

  private activate(startPoint: RasterPoint, endPoint: RasterPoint) {
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
    const node = resolveBrushTargetState(
      this.tool.editor,
      this.targetState,
      clippedStartPoint,
      this.settings
    );

    if (!node) {
      return null;
    }

    this.delegate = new StableRasterStrokeSession({
      node,
      operation: this.operation,
      point: clippedStartPoint,
      settings: this.settings,
      tool: this.tool,
    });
    this.tool.editor.notifyInteractionPreviewChanged();
    this.lastDelegatePoint = clippedStartPoint;

    if (
      clippedEndPoint.x !== clippedStartPoint.x ||
      clippedEndPoint.y !== clippedStartPoint.y
    ) {
      this.delegate.update({ point: clippedEndPoint });
    }

    this.lastDelegatePoint = clippedEndPoint;
    this.delegateDisconnected = !this.getClippedWorldSegment(endPoint, endPoint);
    return clippedEndPoint;
  }

  private forwardClippedSegment(startPoint: RasterPoint, endPoint: RasterPoint) {
    const clipped = this.getClippedWorldSegment(startPoint, endPoint);

    if (!clipped) {
      this.delegateDisconnected = true;
      return;
    }

    if (this.delegateDisconnected) {
      this.delegate?.restart?.({ point: clipped.start });
    } else if (
      this.lastDelegatePoint &&
      (this.lastDelegatePoint.x !== clipped.start.x ||
        this.lastDelegatePoint.y !== clipped.start.y)
    ) {
      this.delegate?.update({ point: clipped.start });
    }

    if (
      !this.lastDelegatePoint ||
      this.lastDelegatePoint.x !== clipped.end.x ||
      this.lastDelegatePoint.y !== clipped.end.y
    ) {
      this.delegate?.update({ point: clipped.end });
    }

    this.delegateDisconnected = !this.getClippedWorldSegment(endPoint, endPoint);
    this.lastDelegatePoint = clipped.end;
  }

  private getClippedWorldSegment(startPoint: RasterPoint, endPoint: RasterPoint) {
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

const composeRasterHistoryPatch = (
  pixelPatch: RasterHistoryPatch | undefined,
  rebase: RasterHistoryPatch | null
): RasterHistoryPatch | null => {
  if (!(pixelPatch || rebase)) {
    return null;
  }

  return {
    redo: () => {
      rebase?.redo();
      pixelPatch?.redo();
    },
    undo: () => {
      pixelPatch?.undo();
      rebase?.undo();
    },
  };
};

const expandFrameRasterToDirtyRegion = (
  editor,
  node,
  target: RasterTarget,
  dirtyRegion
): RasterHistoryPatch | null => {
  if (!(dirtyRegion && node.parentId !== "root")) {
    return null;
  }

  const scaleX = target.pixelSize.width / target.bounds.width;
  const scaleY = target.pixelSize.height / target.bounds.height;
  const dirty = {
    maxX: target.bounds.x + (dirtyRegion.x + dirtyRegion.width) / scaleX,
    maxY: target.bounds.y + (dirtyRegion.y + dirtyRegion.height) / scaleY,
    minX: target.bounds.x + dirtyRegion.x / scaleX,
    minY: target.bounds.y + dirtyRegion.y / scaleY,
  };
  const minX = Math.min(0, Math.floor(dirty.minX));
  const minY = Math.min(0, Math.floor(dirty.minY));
  const maxX = Math.max(node.width, Math.ceil(dirty.maxX));
  const maxY = Math.max(node.height, Math.ceil(dirty.maxY));

  if (minX === 0 && minY === 0 && maxX === node.width && maxY === node.height) {
    return null;
  }

  const beforeNode = editor.getNode(node.id);
  const nextNode = {
    ...beforeNode,
    height: maxY - minY,
    width: maxX - minX,
  };
  const pinnedWorldPoint = getNodeWorldPoint(node, getImageNodeBounds(node), {
    x: 0,
    y: 0,
  });
  const transform = getNodeTransformForPinnedWorldPoint(
    nextNode,
    getImageNodeBounds(nextNode),
    { x: -minX, y: -minY },
    pinnedWorldPoint
  );
  const afterNode = {
    ...nextNode,
    transform: { ...nextNode.transform, ...transform },
  };
  const shiftX = -minX;
  const shiftY = -minY;
  const apply = (next, x, y) => {
    editor.getState().updateNodeById(node.id, next);
    editor.rasterSurface?.shiftSurfaceBounds?.(node.id, x, y);
  };

  apply(afterNode, shiftX, shiftY);
  return {
    redo: () => apply(afterNode, shiftX, shiftY),
    undo: () => apply(beforeNode, -shiftX, -shiftY),
  };
};

const makeRasterSessionIdempotent = <Session extends ManagedRasterStrokeSession>(
  session: Session
): Session => {
  const cancel = session.cancel.bind(session);
  const complete = session.complete.bind(session);
  const update = session.update.bind(session);
  const updateBatch = session.updateBatch?.bind(session);
  let completion = Promise.resolve();
  let state: "active" | "cancelled" | "completed" = "active";

  session.cancel = () => {
    if (state === "active") {
      state = "cancelled";
      cancel();
    }
  };
  session.complete = (input) => {
    if (state !== "active") {
      return completion;
    }
    state = "completed";
    const result = complete(input);
    completion = Promise.resolve(result);
    return result;
  };
  session.update = (input) => {
    if (state === "active") {
      update(input);
    }
  };
  if (updateBatch) {
    session.updateBatch = (inputs) => {
      if (state === "active") {
        updateBatch(inputs);
      }
    };
  }
  return session;
};

export class RasterStrokeRuntime {
  readonly editor: any;
  activeSession: ManagedRasterStrokeSession | null = null;

  constructor(editor: any) {
    this.editor = editor;
  }

  hasActiveSession() {
    return Boolean(this.activeSession);
  }

  getActivePresentationViewport(nodeId: string) {
    const viewport = this.activeSession?.getPresentationViewport?.();

    return viewport?.targetId === nodeId ? viewport : null;
  }

  getCommittedDocumentNodes() {
    return (
      this.activeSession?.getCommittedDocumentNodes?.() ?? this.editor.nodes
    );
  }

  beginStroke({ operation, point, settings }: BeginRasterStrokeInput) {
    return measurePerf("brush.stroke.begin", () => {
      const targetState = getRasterTargetState(this.editor, {
        tool: operation === "erase" ? "eraser" : "brush",
      });

      if (!targetState.enabled) {
        recordRasterDebugEvent("target.missing", {
          activeLayerId: this.editor.activeLayerId,
          activeTool: this.editor.activeTool,
        });
        return null;
      }

      const session = makeRasterSessionIdempotent(
        new DeferredRasterStrokeSession({
          operation,
          point,
          settings,
          targetState,
          tool: this,
        })
      );
      this.activeSession = session;
      this.editor.notifyInteractionPreviewChanged();
      return session;
    });
  }

  clearActiveSession(session: ManagedRasterStrokeSession) {
    if (
      this.activeSession === session ||
      (this.activeSession as DeferredRasterStrokeSession | null)?.delegate ===
        session
    ) {
      this.activeSession = null;
      this.editor.notifyInteractionPreviewChanged();
    }
  }

  cancelActiveStroke() {
    this.activeSession?.cancel();
  }
}
