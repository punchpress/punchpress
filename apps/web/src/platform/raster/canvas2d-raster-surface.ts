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

export const createCanvas2dRasterSurface = (
  canvas: HTMLCanvasElement,
  capabilities: Canvas2dRasterCapabilities,
  notifyPresentationChanged: () => void = () => undefined,
  brushTipCache: Canvas2dBrushTipCache = createCanvas2dBrushTipCache(
    capabilities
  )
): RasterSurface => ({
  beginStroke: (context) =>
    createCanvas2dRasterSurfaceSession(
      canvas,
      context,
      capabilities,
      notifyPresentationChanged,
      brushTipCache
    ),
});

const createCanvas2dRasterSurfaceSession = (
  canvas: HTMLCanvasElement,
  strokeContext: Readonly<RasterStrokeContext>,
  capabilities: Canvas2dRasterCapabilities,
  notifyPresentationChanged: () => void,
  brushTipCache: Canvas2dBrushTipCache
): RasterSurfaceSession => {
  const context = requireCanvas2dContext(canvas);
  let dirtyRegion: RasterDirtyRegion | null = null;
  const rollbackPatches: Array<{
    canvas: HTMLCanvasElement;
    region: RasterDirtyRegion;
  }> = [];
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
        rollbackPatches.push(
          captureRollbackPatch({
            capabilities,
            region: nextDirtyRegion,
            source: canvas,
          })
        );
        dirtyRegion = unionRects(dirtyRegion, nextDirtyRegion);
        context.save();
        clipContextToWritablePolygon(
          context,
          strokeContext.target.writablePolygon
        );
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

      measurePerf(PERF_SPANS.rasterStrokeCancel, () => {
        for (let index = rollbackPatches.length - 1; index >= 0; index -= 1) {
          const patch = rollbackPatches[index];

          context.clearRect(
            patch.region.x,
            patch.region.y,
            patch.region.width,
            patch.region.height
          );
          context.drawImage(patch.canvas, patch.region.x, patch.region.y);
        }
        notifyPresentationChanged();
      });
    },
    commit: () => {
      requireActive();
      state = "committed";
      return measurePerf(PERF_SPANS.rasterStrokeCommit, () => {
        if (dirtyRegion) {
          incrementPerfCounter(
            PERF_COUNTERS.rasterStrokeDirtyAreaPixels,
            dirtyRegion.width * dirtyRegion.height
          );
        }

        return {
          dirtyRegion,
          targetId: strokeContext.target.id,
        };
      });
    },
  };
};

const clipContextToWritablePolygon = (
  context: CanvasRenderingContext2D,
  polygon: readonly Readonly<RasterPoint>[] | undefined
) => {
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
};

const captureRollbackPatch = ({
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
  context.beginPath();

  for (const dab of dabs) {
    context.moveTo(
      (dab.center.x - target.bounds.x + dab.size * 0.5) * scale,
      (dab.center.y - target.bounds.y) * scale
    );
    context.arc(
      (dab.center.x - target.bounds.x) * scale,
      (dab.center.y - target.bounds.y) * scale,
      dab.size * scale * 0.5,
      0,
      Math.PI * 2
    );
  }

  context.fill();
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
    const radiusX = (dab.size * scaleX) / 2;
    const radiusY = (dab.size * scaleY) / 2;
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
