import {
  PERF_SPANS,
  type RasterSurfaceResolver,
  recordPerfSpan,
} from "@punchpress/engine";
import { createCanvas2dBrushTipCache } from "./brush-tip-cache";
import {
  browserCanvas2dCapabilities,
  type Canvas2dRasterCapabilities,
  requireCanvas2dContext,
} from "./canvas2d-raster-capabilities";
import {
  type Canvas2dRasterSurface,
  createCanvas2dRasterSurface,
} from "./canvas2d-raster-surface";

interface EnsureCanvas2dRasterSurfaceInput {
  authoritative?: boolean;
  bounds?: { height: number; width: number; x: number; y: number };
  height: number;
  id: string;
  sourceBounds?: { height: number; width: number; x: number; y: number };
  src: string;
  width: number;
}

export interface Canvas2dRasterPresentation {
  canvas: HTMLCanvasElement;
  height: number;
  sourceBounds: { height: number; width: number; x: number; y: number };
  width: number;
  x: number;
  y: number;
}

export interface Canvas2dRasterRuntime extends RasterSurfaceResolver {
  cancelResample: (targetId: string) => void;
  ensureSurface: (
    input: EnsureCanvas2dRasterSurfaceInput
  ) => Promise<Canvas2dRasterPresentation>;
  getPresentation: (targetId: string) => Canvas2dRasterPresentation | null;
  resetSurfaces: () => void;
  shiftSurfaceBounds: (targetId: string, x: number, y: number) => void;
  snapshotSurface: (
    targetId: string,
    sourceBounds?: { height: number; width: number; x: number; y: number }
  ) => {
    height: number;
    src: string;
    width: number;
    x: number;
    y: number;
  } | null;
  snapshotSurfaceAsync: (
    targetId: string,
    region: { height: number; width: number; x: number; y: number },
    sourceBounds?: { height: number; width: number; x: number; y: number }
  ) => Promise<{
    height: number;
    pixelHeight: number;
    pixelWidth: number;
    src: string;
    width: number;
  } | null>;
  subscribe: (listener: () => void) => () => void;
  subscribePresentation: (targetId: string, listener: () => void) => () => void;
}

export const createCanvas2dRasterRuntime = (
  capabilities: Canvas2dRasterCapabilities = browserCanvas2dCapabilities
): Canvas2dRasterRuntime => {
  const brushTipCache = createCanvas2dBrushTipCache(capabilities);
  const records = new Map<
    string,
    {
      key: string;
      presentation: Canvas2dRasterPresentation;
      source: string;
      surface: Canvas2dRasterSurface;
    }
  >();
  const pending = new Map<
    string,
    {
      authoritative: boolean;
      key: string;
      promise: Promise<Canvas2dRasterPresentation>;
    }
  >();
  const listeners = new Set<() => void>();
  const presentationListeners = new Map<string, Set<() => void>>();
  const resampleVersions = new Map<string, number>();
  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };
  const notifyPresentation = (targetId: string) => {
    for (const listener of presentationListeners.get(targetId) ?? []) {
      listener();
    }
  };

  return {
    cancelResample: (targetId) => {
      resampleVersions.set(targetId, (resampleVersions.get(targetId) ?? 0) + 1);
    },
    ensureSurface: async (input) => {
      const current = records.get(input.id);
      const pendingSurface = pending.get(input.id);

      if (pendingSurface?.authoritative && !input.authoritative) {
        return await pendingSurface.promise;
      }

      if (current && current.key === getSurfaceKey(input)) {
        return current.presentation;
      }

      if (current) {
        records.delete(input.id);
        notify();
      }

      const key = getSurfaceKey(input);
      if (pendingSurface?.key === key) {
        return await pendingSurface.promise;
      }

      const preparation = prepareSurface(
        input,
        capabilities,
        brushTipCache,
        () => {
          notifyPresentation(input.id);
        }
      ).then((record) => {
        if (pending.get(input.id)?.key === key) {
          records.set(input.id, record);
          notify();
        }

        return record.presentation;
      });

      pending.set(input.id, {
        authoritative: Boolean(input.authoritative),
        key,
        promise: preparation,
      });

      try {
        return await preparation;
      } finally {
        if (pending.get(input.id)?.key === key) {
          pending.delete(input.id);
        }
      }
    },
    getPresentation: (targetId) => records.get(targetId)?.presentation || null,
    getSurfaceGeometry: (targetId, sourceBounds) => {
      const presentation = records.get(targetId)?.presentation;

      return presentation
        ? {
            bounds: getCanvas2dRasterDisplay(presentation, sourceBounds),
            pixelSize: {
              height: presentation.canvas.height,
              width: presentation.canvas.width,
            },
          }
        : null;
    },
    retainTargets: (targetIds) => {
      const retainedIds = new Set(targetIds);

      for (const targetId of pending.keys()) {
        if (!retainedIds.has(targetId)) {
          pending.delete(targetId);
        }
      }
    },
    resetSurfaces: () => {
      records.clear();
      pending.clear();
      resampleVersions.clear();
      notify();
    },
    resampleSurface: async ({ bounds, pixelSize, sourceBounds, targetId }) => {
      const beforeRecord = records.get(targetId);

      if (!beforeRecord) {
        throw new Error(`Raster surface is not resident: ${targetId}`);
      }

      const version = (resampleVersions.get(targetId) ?? 0) + 1;
      resampleVersions.set(targetId, version);
      await capabilities.scheduleResample?.();

      if (
        resampleVersions.get(targetId) !== version ||
        records.get(targetId) !== beforeRecord
      ) {
        throw new Error(`Raster resample was superseded: ${targetId}`);
      }

      const resampleStartedAt = getNow();
      const canvas = capabilities.createCanvas(
        pixelSize.width,
        pixelSize.height
      );
      drawHighQualityResample(
        capabilities,
        beforeRecord.presentation.canvas,
        canvas
      );
      const resampleEndedAt = getNow();

      recordPerfSpan({
        depth: 0,
        durationMs: resampleEndedAt - resampleStartedAt,
        endMs: resampleEndedAt,
        label: PERF_SPANS.rasterSurfaceResample,
        startMs: resampleStartedAt,
      });

      if (
        resampleVersions.get(targetId) !== version ||
        records.get(targetId) !== beforeRecord
      ) {
        throw new Error(`Raster resample was superseded: ${targetId}`);
      }

      const afterRecord = {
        key: `${pixelSize.width}:${pixelSize.height}:${bounds.x}:${bounds.y}:${beforeRecord.source}`,
        presentation: {
          canvas,
          height: bounds.height,
          sourceBounds: { ...sourceBounds },
          width: bounds.width,
          x: bounds.x,
          y: bounds.y,
        },
        source: beforeRecord.source,
        surface: createCanvas2dRasterSurface(
          canvas,
          capabilities,
          () => notifyPresentation(targetId),
          brushTipCache
        ),
      };
      const publish = (record) => {
        records.set(targetId, record);
        notify();
        notifyPresentation(targetId);
      };

      return {
        redo: () => publish(afterRecord),
        undo: () => publish(beforeRecord),
      };
    },
    resolveSurface: (target) => {
      const record = records.get(target.id);

      if (
        !(
          record &&
          record.presentation.canvas.width === target.pixelSize.width &&
          record.presentation.canvas.height === target.pixelSize.height
        )
      ) {
        return null;
      }

      return record.surface;
    },
    snapshotSurface: (targetId, sourceBounds) => {
      const record = records.get(targetId);
      const presentation = record?.presentation;

      if (!presentation) {
        return null;
      }

      const display = getCanvas2dRasterDisplay(presentation, sourceBounds);

      return {
        ...display,
        src: presentation.canvas.toDataURL("image/png"),
      };
    },
    snapshotSurfaceAsync: async (targetId, region, sourceBounds) => {
      const record = records.get(targetId);
      const presentation = record?.presentation;

      if (!(record && presentation)) {
        return null;
      }

      const display = getCanvas2dRasterDisplay(presentation, sourceBounds);
      const scaleX = presentation.canvas.width / display.width;
      const scaleY = presentation.canvas.height / display.height;
      const width = Math.max(1, Math.ceil(region.width * scaleX));
      const height = Math.max(1, Math.ceil(region.height * scaleY));
      const sourceX = (region.x - display.x) * scaleX;
      const sourceY = (region.y - display.y) * scaleY;
      const isFullSurface =
        sourceX === 0 &&
        sourceY === 0 &&
        width === presentation.canvas.width &&
        height === presentation.canvas.height;
      const uncommittedPatches = record.surface.getUncommittedPatches();
      const canvas =
        isFullSurface && uncommittedPatches.length === 0
          ? presentation.canvas
          : capabilities.createCanvas(width, height);

      if (canvas !== presentation.canvas) {
        const context = requireCanvas2dContext(canvas);

        context.drawImage(
          presentation.canvas,
          sourceX,
          sourceY,
          width,
          height,
          0,
          0,
          width,
          height
        );
        restoreCommittedPixels({
          context,
          height,
          patches: uncommittedPatches,
          source: { height, width, x: sourceX, y: sourceY },
          width,
        });
      }

      const encodeStartedAt = getNow();
      const src = await capabilities.encodeCanvas(canvas);
      const encodeEndedAt = getNow();

      recordPerfSpan({
        depth: 0,
        durationMs: encodeEndedAt - encodeStartedAt,
        endMs: encodeEndedAt,
        label: PERF_SPANS.rasterSurfaceEncode,
        startMs: encodeStartedAt,
      });

      return {
        height: region.height,
        pixelHeight: height,
        pixelWidth: width,
        src,
        width: region.width,
      };
    },
    shiftSurfaceBounds: (targetId, x, y) => {
      const presentation = records.get(targetId)?.presentation;

      if (!(presentation && (x || y))) {
        return;
      }

      presentation.x += x;
      presentation.y += y;
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribePresentation: (targetId, listener) => {
      const targetListeners =
        presentationListeners.get(targetId) ?? new Set<() => void>();

      targetListeners.add(listener);
      presentationListeners.set(targetId, targetListeners);

      return () => {
        targetListeners.delete(listener);

        if (targetListeners.size === 0) {
          presentationListeners.delete(targetId);
        }
      };
    },
  };
};

const drawHighQualityResample = (
  capabilities: Canvas2dRasterCapabilities,
  source: HTMLCanvasElement,
  target: HTMLCanvasElement
) => {
  let current = source;
  const targetWidth = target.width;
  const targetHeight = target.height;
  const targetContext = requireCanvas2dContext(target);
  const supportsQuality = "imageSmoothingQuality" in targetContext;

  if (!supportsQuality) {
    while (
      current.width / 2 > targetWidth ||
      current.height / 2 > targetHeight
    ) {
      const width = Math.max(targetWidth, Math.floor(current.width / 2));
      const height = Math.max(targetHeight, Math.floor(current.height / 2));
      const intermediate = capabilities.createCanvas(width, height);
      const context = requireCanvas2dContext(intermediate);

      context.imageSmoothingEnabled = true;
      context.drawImage(
        current,
        0,
        0,
        current.width,
        current.height,
        0,
        0,
        width,
        height
      );
      current = intermediate;
    }
  }

  targetContext.imageSmoothingEnabled = true;

  if (supportsQuality) {
    targetContext.imageSmoothingQuality = "high";
  }

  targetContext.drawImage(
    current,
    0,
    0,
    current.width,
    current.height,
    0,
    0,
    targetWidth,
    targetHeight
  );
};

const restoreCommittedPixels = ({
  context,
  height,
  patches,
  source,
  width,
}: {
  context: CanvasRenderingContext2D;
  height: number;
  patches: readonly {
    canvas: HTMLCanvasElement;
    region: { height: number; width: number; x: number; y: number };
  }[];
  source: { height: number; width: number; x: number; y: number };
  width: number;
}) => {
  const scaleX = width / source.width;
  const scaleY = height / source.height;

  for (const patch of patches) {
    const left = Math.max(source.x, patch.region.x);
    const top = Math.max(source.y, patch.region.y);
    const right = Math.min(
      source.x + source.width,
      patch.region.x + patch.region.width
    );
    const bottom = Math.min(
      source.y + source.height,
      patch.region.y + patch.region.height
    );

    if (right <= left || bottom <= top) {
      continue;
    }

    const destinationX = (left - source.x) * scaleX;
    const destinationY = (top - source.y) * scaleY;
    const destinationWidth = (right - left) * scaleX;
    const destinationHeight = (bottom - top) * scaleY;

    context.clearRect(
      destinationX,
      destinationY,
      destinationWidth,
      destinationHeight
    );
    context.drawImage(
      patch.canvas,
      left - patch.region.x,
      top - patch.region.y,
      right - left,
      bottom - top,
      destinationX,
      destinationY,
      destinationWidth,
      destinationHeight
    );
  }
};

const getSurfaceKey = ({
  bounds,
  height,
  src,
  width,
}: EnsureCanvas2dRasterSurfaceInput) =>
  `${width}:${height}:${bounds?.x ?? 0}:${bounds?.y ?? 0}:${src}`;

const prepareSurface = async (
  input: EnsureCanvas2dRasterSurfaceInput,
  capabilities: Canvas2dRasterCapabilities,
  brushTipCache: ReturnType<typeof createCanvas2dBrushTipCache>,
  notifyPresentationChanged: () => void
) => {
  const canvas = capabilities.createCanvas(input.width, input.height);
  const context = requireCanvas2dContext(canvas);
  const decodeStartedAt = getNow();
  const image = await capabilities.decodeImage(input.src);
  const decodeEndedAt = getNow();

  recordPerfSpan({
    depth: 0,
    durationMs: decodeEndedAt - decodeStartedAt,
    endMs: decodeEndedAt,
    label: PERF_SPANS.rasterSurfaceDecode,
    startMs: decodeStartedAt,
  });

  const bounds = input.bounds ?? {
    height: input.height,
    width: input.width,
    x: 0,
    y: 0,
  };
  const sourceBounds = input.sourceBounds ?? {
    height: bounds.height,
    width: bounds.width,
    x: bounds.x,
    y: bounds.y,
  };
  const scaleX = input.width / bounds.width;
  const scaleY = input.height / bounds.height;

  context.drawImage(
    image,
    (sourceBounds.x - bounds.x) * scaleX,
    (sourceBounds.y - bounds.y) * scaleY,
    sourceBounds.width * scaleX,
    sourceBounds.height * scaleY
  );

  return {
    key: getSurfaceKey(input),
    presentation: {
      canvas,
      height: bounds.height,
      sourceBounds: { ...sourceBounds },
      width: bounds.width,
      x: bounds.x,
      y: bounds.y,
    },
    source: input.src,
    surface: createCanvas2dRasterSurface(
      canvas,
      capabilities,
      notifyPresentationChanged,
      brushTipCache
    ),
  };
};

export const getCanvas2dRasterDisplay = (
  presentation: Canvas2dRasterPresentation,
  sourceBounds = presentation.sourceBounds
) => {
  const scaleX = sourceBounds.width / presentation.sourceBounds.width;
  const scaleY = sourceBounds.height / presentation.sourceBounds.height;

  return {
    height: presentation.height * scaleY,
    width: presentation.width * scaleX,
    x: sourceBounds.x + (presentation.x - presentation.sourceBounds.x) * scaleX,
    y: sourceBounds.y + (presentation.y - presentation.sourceBounds.y) * scaleY,
  };
};

const getNow = () =>
  typeof performance === "undefined" ? Date.now() : performance.now();
