import {
  PERF_SPANS,
  type RasterSurface,
  type RasterSurfaceResolver,
  recordPerfSpan,
} from "@punchpress/engine";
import {
  browserCanvas2dCapabilities,
  type Canvas2dRasterCapabilities,
  requireCanvas2dContext,
} from "./canvas2d-raster-capabilities";
import { createCanvas2dRasterSurface } from "./canvas2d-raster-surface";

interface EnsureCanvas2dRasterSurfaceInput {
  height: number;
  id: string;
  src: string;
  width: number;
}

interface Canvas2dRasterPresentation {
  canvas: HTMLCanvasElement;
  height: number;
  width: number;
}

export interface Canvas2dRasterRuntime extends RasterSurfaceResolver {
  ensureSurface: (
    input: EnsureCanvas2dRasterSurfaceInput
  ) => Promise<Canvas2dRasterPresentation>;
  getPresentation: (targetId: string) => Canvas2dRasterPresentation | null;
  snapshotSurface: (
    targetId: string
  ) => { height: number; src: string; width: number } | null;
  subscribe: (listener: () => void) => () => void;
}

export const createCanvas2dRasterRuntime = (
  capabilities: Canvas2dRasterCapabilities = browserCanvas2dCapabilities
): Canvas2dRasterRuntime => {
  const records = new Map<
    string,
    {
      presentation: Canvas2dRasterPresentation;
      source: string;
      surface: RasterSurface;
    }
  >();
  const pending = new Map<
    string,
    {
      key: string;
      promise: Promise<Canvas2dRasterPresentation>;
    }
  >();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    ensureSurface: async (input) => {
      const current = records.get(input.id);

      if (
        current &&
        current.source === input.src &&
        current.presentation.width === input.width &&
        current.presentation.height === input.height
      ) {
        return current.presentation;
      }

      if (current) {
        records.delete(input.id);
        notify();
      }

      const key = getSurfaceKey(input);
      const pendingSurface = pending.get(input.id);

      if (pendingSurface?.key === key) {
        return await pendingSurface.promise;
      }

      const preparation = prepareSurface(input, capabilities).then((record) => {
        if (pending.get(input.id)?.key === key) {
          records.set(input.id, record);
          notify();
        }

        return record.presentation;
      });

      pending.set(input.id, { key, promise: preparation });

      try {
        return await preparation;
      } finally {
        if (pending.get(input.id)?.key === key) {
          pending.delete(input.id);
        }
      }
    },
    getPresentation: (targetId) => records.get(targetId)?.presentation || null,
    retainTargets: (targetIds) => {
      const retainedIds = new Set(targetIds);
      let didChange = false;

      for (const targetId of records.keys()) {
        if (!retainedIds.has(targetId)) {
          records.delete(targetId);
          didChange = true;
        }
      }

      for (const targetId of pending.keys()) {
        if (!retainedIds.has(targetId)) {
          pending.delete(targetId);
        }
      }

      if (didChange) {
        notify();
      }
    },
    resolveSurface: (target) => {
      const record = records.get(target.id);

      if (
        !(
          record &&
          record.presentation.width === target.pixelSize.width &&
          record.presentation.height === target.pixelSize.height
        )
      ) {
        return null;
      }

      return record.surface;
    },
    snapshotSurface: (targetId) => {
      const presentation = records.get(targetId)?.presentation;

      return presentation
        ? {
            height: presentation.canvas.height,
            src: presentation.canvas.toDataURL("image/png"),
            width: presentation.canvas.width,
          }
        : null;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

const getSurfaceKey = ({
  height,
  src,
  width,
}: EnsureCanvas2dRasterSurfaceInput) => `${width}:${height}:${src}`;

const prepareSurface = async (
  input: EnsureCanvas2dRasterSurfaceInput,
  capabilities: Canvas2dRasterCapabilities
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

  context.clearRect(0, 0, input.width, input.height);
  context.drawImage(image, 0, 0, input.width, input.height);

  return {
    presentation: {
      canvas,
      height: input.height,
      width: input.width,
    },
    source: input.src,
    surface: createCanvas2dRasterSurface(canvas, capabilities),
  };
};

const getNow = () =>
  typeof performance === "undefined" ? Date.now() : performance.now();
