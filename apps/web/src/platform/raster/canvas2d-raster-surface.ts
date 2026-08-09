import {
  incrementPerfCounter,
  measurePerf,
  PERF_COUNTERS,
  PERF_SPANS,
  type RasterDab,
  type RasterDirtyRegion,
  type RasterPoint,
  type RasterStrokeContext,
  type RasterSurface,
  type RasterSurfaceSession,
  type RasterTarget,
} from "@punchpress/engine";
import {
  type Canvas2dBrushTipCache,
  createCanvas2dBrushTipCache,
} from "./brush-tip-cache";
import {
  type Canvas2dRasterCapabilities,
  requireCanvas2dContext,
} from "./canvas2d-raster-capabilities";

export interface Canvas2dRasterSurface extends RasterSurface {
  getUncommittedPatches: () => readonly Canvas2dRasterPatch[];
}

export interface Canvas2dRasterPatch {
  canvas: HTMLCanvasElement;
  region: RasterDirtyRegion;
}

export const createCanvas2dRasterSurface = (
  canvas: HTMLCanvasElement,
  capabilities: Canvas2dRasterCapabilities,
  notifyPresentationChanged: () => void = () => undefined,
  brushTipCache: Canvas2dBrushTipCache = createCanvas2dBrushTipCache(
    capabilities
  )
): Canvas2dRasterSurface => {
  let uncommittedPatches: readonly Canvas2dRasterPatch[] = [];

  return {
    beginStroke: (context) => {
      const session = createCanvas2dRasterSurfaceSession(
        canvas,
        context,
        capabilities,
        notifyPresentationChanged,
        brushTipCache,
        (patches) => {
          uncommittedPatches = patches;
        }
      );

      return session;
    },
    getUncommittedPatches: () => uncommittedPatches,
  };
};

const createCanvas2dRasterSurfaceSession = (
  canvas: HTMLCanvasElement,
  strokeContext: Readonly<RasterStrokeContext>,
  capabilities: Canvas2dRasterCapabilities,
  notifyPresentationChanged: () => void,
  brushTipCache: Canvas2dBrushTipCache,
  setUncommittedPatches: (patches: readonly Canvas2dRasterPatch[]) => void
): RasterSurfaceSession => {
  const context = requireCanvas2dContext(canvas);
  let dirtyRegion: RasterDirtyRegion | null = null;
  const rollbackPatches: Canvas2dRasterPatch[] = [];
  let isFirstDab = true;
  let state: "active" | "cancelled" | "committed" = "active";

  const requireActive = () => {
    if (state !== "active") {
      throw new Error(`Canvas2D Raster session is already ${state}`);
    }
  };

  return {
    applyDabs: (dabs) => {
      requireActive();
      if (dabs.length === 0) {
        return;
      }

      const nextDirtyRegion = getDabsDirtyRegion(dabs, strokeContext.target);

      if (!nextDirtyRegion) {
        return;
      }

      const apply = () => {
        const nextUnion = unionRects(dirtyRegion, nextDirtyRegion);

        for (const region of subtractContainedRect(nextUnion, dirtyRegion)) {
          rollbackPatches.push(
            captureRasterPatch({ capabilities, region, source: canvas })
          );
        }
        setUncommittedPatches(rollbackPatches);
        dirtyRegion = nextUnion;
        context.save();
        clipContextToWritablePolygon(context, strokeContext.target);
        paintDabs(context, dabs, strokeContext, brushTipCache);
        context.restore();
        notifyPresentationChanged();
        incrementPerfCounter(PERF_COUNTERS.rasterStrokeDabs, dabs.length);
        incrementPerfCounter(PERF_COUNTERS.rasterStrokeDirectPresentation);
        incrementPerfCounter(PERF_COUNTERS.rasterStrokeVisualLagFrames, 0);
      };

      measurePerf(PERF_SPANS.rasterStrokeApplyDabs, () => {
        if (isFirstDab) {
          isFirstDab = false;
          measurePerf(PERF_SPANS.rasterStrokeFirstDab, apply);
          return;
        }

        apply();
      });
    },
    cancel: () => {
      requireActive();
      state = "cancelled";
      setUncommittedPatches([]);

      measurePerf(PERF_SPANS.rasterStrokeCancel, () => {
        const beforePatch = createCombinedBeforePatch({
          capabilities,
          dirtyRegion,
          patches: rollbackPatches,
        });

        if (beforePatch) {
          applyRasterPatches(context, [beforePatch]);
        }
        notifyPresentationChanged();
      });
    },
    commit: () => {
      requireActive();
      state = "committed";
      setUncommittedPatches([]);
      return measurePerf(PERF_SPANS.rasterStrokeCommit, () => {
        if (dirtyRegion) {
          incrementPerfCounter(
            PERF_COUNTERS.rasterStrokeDirtyAreaPixels,
            dirtyRegion.width * dirtyRegion.height
          );
        }

        const afterPatch = dirtyRegion
          ? captureRasterPatch({
              capabilities,
              region: dirtyRegion,
              source: canvas,
            })
          : null;
        const beforePatch = createCombinedBeforePatch({
          capabilities,
          dirtyRegion,
          patches: rollbackPatches,
        });

        return {
          dirtyRegion,
          ...(dirtyRegion
            ? {
                patch: {
                  redo: () => {
                    if (afterPatch) {
                      applyRasterPatches(context, [afterPatch]);
                    }
                    notifyPresentationChanged();
                  },
                  undo: () => {
                    if (beforePatch) {
                      applyRasterPatches(context, [beforePatch]);
                    }
                    notifyPresentationChanged();
                  },
                },
              }
            : {}),
          targetId: strokeContext.target.id,
        };
      });
    },
  };
};

const clipContextToWritablePolygon = (
  context: CanvasRenderingContext2D,
  target: Readonly<RasterTarget>
) => {
  const polygon = target.writablePolygon;

  if (!polygon?.length) {
    return;
  }

  const scaleX = target.pixelSize.width / target.bounds.width;
  const scaleY = target.pixelSize.height / target.bounds.height;
  const toPixelPoint = (point: Readonly<RasterPoint>) => ({
    x: (point.x - target.bounds.x) * scaleX,
    y: (point.y - target.bounds.y) * scaleY,
  });
  const firstPoint = toPixelPoint(polygon[0]);

  context.beginPath();
  context.moveTo(firstPoint.x, firstPoint.y);
  for (const point of polygon.slice(1)) {
    const pixelPoint = toPixelPoint(point);

    context.lineTo(pixelPoint.x, pixelPoint.y);
  }
  context.closePath();
  context.clip();
};

const captureRasterPatch = ({
  capabilities,
  region,
  source,
}: {
  capabilities: Canvas2dRasterCapabilities;
  region: RasterDirtyRegion;
  source: HTMLCanvasElement;
}) => {
  const canvas = capabilities.createCanvas(region.width, region.height);
  const context = requireCanvas2dContext(canvas);

  context.drawImage(
    source,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    region.width,
    region.height
  );

  return { canvas, region };
};

const applyRasterPatches = (
  context: CanvasRenderingContext2D,
  patches: readonly {
    canvas: HTMLCanvasElement;
    region: RasterDirtyRegion;
  }[]
) => {
  for (const patch of patches) {
    context.clearRect(
      patch.region.x,
      patch.region.y,
      patch.region.width,
      patch.region.height
    );
    context.drawImage(patch.canvas, patch.region.x, patch.region.y);
  }
};

const createCombinedBeforePatch = ({
  capabilities,
  dirtyRegion,
  patches,
}: {
  capabilities: Canvas2dRasterCapabilities;
  dirtyRegion: RasterDirtyRegion | null;
  patches: readonly { canvas: HTMLCanvasElement; region: RasterDirtyRegion }[];
}) => {
  if (!dirtyRegion) {
    return null;
  }

  const combined = {
    canvas: capabilities.createCanvas(dirtyRegion.width, dirtyRegion.height),
    region: dirtyRegion,
  };
  const context = requireCanvas2dContext(combined.canvas);

  for (const patch of patches) {
    const x = patch.region.x - dirtyRegion.x;
    const y = patch.region.y - dirtyRegion.y;

    context.drawImage(patch.canvas, x, y);
  }

  return combined;
};

const subtractContainedRect = (
  outer: RasterDirtyRegion,
  inner: RasterDirtyRegion | null
): RasterDirtyRegion[] => {
  if (!inner) {
    return [outer];
  }

  const outerMaxX = outer.x + outer.width;
  const outerMaxY = outer.y + outer.height;
  const innerMaxX = inner.x + inner.width;
  const innerMaxY = inner.y + inner.height;
  const regions = [
    { height: inner.y - outer.y, width: outer.width, x: outer.x, y: outer.y },
    {
      height: outerMaxY - innerMaxY,
      width: outer.width,
      x: outer.x,
      y: innerMaxY,
    },
    {
      height: inner.height,
      width: inner.x - outer.x,
      x: outer.x,
      y: inner.y,
    },
    {
      height: inner.height,
      width: outerMaxX - innerMaxX,
      x: innerMaxX,
      y: inner.y,
    },
  ];

  return regions.filter(({ height, width }) => height > 0 && width > 0);
};

const paintDabs = (
  context: CanvasRenderingContext2D,
  dabs: readonly RasterDab[],
  strokeContext: Readonly<RasterStrokeContext>,
  brushTipCache: Canvas2dBrushTipCache
) => {
  const scaleX =
    strokeContext.target.pixelSize.width / strokeContext.target.bounds.width;
  const scaleY =
    strokeContext.target.pixelSize.height / strokeContext.target.bounds.height;
  const writableBounds =
    strokeContext.target.writableBounds || strokeContext.target.bounds;

  context.save();
  if (strokeContext.target.writableBounds) {
    context.beginPath();
    context.rect(
      (writableBounds.x - strokeContext.target.bounds.x) * scaleX,
      (writableBounds.y - strokeContext.target.bounds.y) * scaleY,
      writableBounds.width * scaleX,
      writableBounds.height * scaleY
    );
    context.clip();
  }
  context.globalCompositeOperation =
    strokeContext.operation === "erase" ? "destination-out" : "source-over";

  if (canUseNativeRoundPath(strokeContext, scaleX, scaleY)) {
    paintNativeRoundPath(context, dabs, strokeContext.target, scaleX);
  } else {
    for (const dab of dabs) {
      stampDab(
        context,
        dab,
        strokeContext.target,
        scaleX,
        scaleY,
        brushTipCache
      );
    }
  }

  context.restore();
};

const canUseNativeRoundPath = (
  strokeContext: Readonly<RasterStrokeContext>,
  scaleX: number,
  scaleY: number
) =>
  Math.abs(scaleX - scaleY) < 1e-9 &&
  strokeContext.settings.tip.kind === "round" &&
  strokeContext.settings.hardness === 1 &&
  strokeContext.settings.flow === 1 &&
  strokeContext.settings.opacity === 1 &&
  strokeContext.settings.roundness === 1 &&
  strokeContext.settings.angle === 0 &&
  strokeContext.settings.angleJitter === 0 &&
  strokeContext.settings.scatter === 0 &&
  strokeContext.settings.sizeJitter === 0 &&
  strokeContext.settings.spacing === 0;

const paintNativeRoundPath = (
  context: CanvasRenderingContext2D,
  dabs: readonly RasterDab[],
  target: Readonly<RasterTarget>,
  scale: number
) => {
  const first = dabs[0];

  context.globalAlpha = first.opacity;
  context.fillStyle = first.color;
  context.strokeStyle = first.color;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = first.size * scale;
  const runs: RasterDab[][] = [];

  for (const dab of dabs) {
    if (runs.length === 0 || dab.startsRun) {
      runs.push([]);
    }
    runs.at(-1)?.push(dab);
  }

  for (const run of runs) {
    const runStart = run[0];
    const x = (runStart.center.x - target.bounds.x) * scale;
    const y = (runStart.center.y - target.bounds.y) * scale;

    context.beginPath();
    if (run.length === 1) {
      context.arc(x, y, runStart.size * scale * 0.5, 0, Math.PI * 2);
      context.fill();
      continue;
    }

    context.moveTo(x, y);
    for (const dab of run.slice(1)) {
      context.lineTo(
        (dab.center.x - target.bounds.x) * scale,
        (dab.center.y - target.bounds.y) * scale
      );
    }
    context.stroke();
  }
};

const stampDab = (
  context: CanvasRenderingContext2D,
  dab: Readonly<RasterDab>,
  target: Readonly<RasterTarget>,
  scaleX: number,
  scaleY: number,
  brushTipCache: Canvas2dBrushTipCache
) => {
  const tip = brushTipCache.get(dab);
  const x = (dab.center.x - target.bounds.x) * scaleX;
  const y = (dab.center.y - target.bounds.y) * scaleY;
  const width = dab.size * scaleX;
  const height = dab.size * dab.roundness * scaleY;

  context.save();
  context.globalAlpha = dab.opacity * dab.flow;
  context.imageSmoothingEnabled = !(
    dab.tip.kind === "sampled" && dab.tip.sampleId === "pixel"
  );
  context.translate(x, y);
  context.rotate((dab.angle * Math.PI) / 180);
  context.scale(width, height);
  context.drawImage(tip, -0.5, -0.5, 1, 1);
  context.restore();
};

const getDabsDirtyRegion = (
  dabs: readonly RasterDab[],
  target: Readonly<RasterTarget>
) => {
  let region: RasterDirtyRegion | null = null;
  const scaleX = target.pixelSize.width / target.bounds.width;
  const scaleY = target.pixelSize.height / target.bounds.height;
  const writableBounds = target.writableBounds || target.bounds;
  const writableMinX = Math.max(
    0,
    Math.floor((writableBounds.x - target.bounds.x) * scaleX)
  );
  const writableMinY = Math.max(
    0,
    Math.floor((writableBounds.y - target.bounds.y) * scaleY)
  );
  const writableMaxX = Math.min(
    target.pixelSize.width,
    Math.ceil(
      (writableBounds.x + writableBounds.width - target.bounds.x) * scaleX
    )
  );
  const writableMaxY = Math.min(
    target.pixelSize.height,
    Math.ceil(
      (writableBounds.y + writableBounds.height - target.bounds.y) * scaleY
    )
  );

  for (const dab of dabs) {
    const centerX = (dab.center.x - target.bounds.x) * scaleX;
    const centerY = (dab.center.y - target.bounds.y) * scaleY;
    const angle = (dab.angle * Math.PI) / 180;
    const cosine = Math.abs(Math.cos(angle));
    const sine = Math.abs(Math.sin(angle));
    const width = dab.size * scaleX;
    const height = dab.size * dab.roundness * scaleY;
    const radiusX = (cosine * width + sine * height) / 2;
    const radiusY = (sine * width + cosine * height) / 2;
    const minX = Math.max(writableMinX, Math.floor(centerX - radiusX));
    const minY = Math.max(writableMinY, Math.floor(centerY - radiusY));
    const maxX = Math.min(writableMaxX, Math.ceil(centerX + radiusX));
    const maxY = Math.min(writableMaxY, Math.ceil(centerY + radiusY));

    if (maxX <= minX || maxY <= minY) {
      continue;
    }

    region = unionRects(region, {
      height: maxY - minY,
      width: maxX - minX,
      x: minX,
      y: minY,
    });
  }

  return region;
};

const unionRects = (
  first: RasterDirtyRegion | null,
  second: RasterDirtyRegion
): RasterDirtyRegion => {
  if (!first) {
    return second;
  }

  const x = Math.min(first.x, second.x);
  const y = Math.min(first.y, second.y);
  const maxX = Math.max(first.x + first.width, second.x + second.width);
  const maxY = Math.max(first.y + first.height, second.y + second.height);

  return {
    height: maxY - y,
    width: maxX - x,
    x,
    y,
  };
};
