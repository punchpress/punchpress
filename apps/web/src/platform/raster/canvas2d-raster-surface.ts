import {
  incrementPerfCounter,
  measurePerf,
  PERF_COUNTERS,
  PERF_SPANS,
  type RasterDab,
  type RasterDirtyRegion,
  type RasterStrokeContext,
  type RasterSurface,
  type RasterSurfaceSession,
  type RasterTarget,
} from "@punchpress/engine";
import {
  type Canvas2dRasterCapabilities,
  requireCanvas2dContext,
} from "./canvas2d-raster-capabilities";

export const createCanvas2dRasterSurface = (
  canvas: HTMLCanvasElement,
  capabilities: Canvas2dRasterCapabilities
): RasterSurface => ({
  beginStroke: (context) =>
    createCanvas2dRasterSurfaceSession(canvas, context, capabilities),
});

const createCanvas2dRasterSurfaceSession = (
  canvas: HTMLCanvasElement,
  strokeContext: Readonly<RasterStrokeContext>,
  capabilities: Canvas2dRasterCapabilities
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
      assertHardRoundDabs(dabs);

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
        paintDabs(context, dabs, strokeContext);
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
  strokeContext: Readonly<RasterStrokeContext>
) => {
  const scaleX =
    strokeContext.target.pixelSize.width / strokeContext.target.bounds.width;
  const scaleY =
    strokeContext.target.pixelSize.height / strokeContext.target.bounds.height;

  context.save();
  context.globalAlpha = strokeContext.settings.opacity;
  context.globalCompositeOperation =
    strokeContext.operation === "erase" ? "destination-out" : "source-over";
  context.fillStyle =
    strokeContext.operation === "erase"
      ? "#000000"
      : strokeContext.settings.color;

  if (strokeContext.settings.opacity === 1) {
    context.beginPath();

    for (const dab of dabs) {
      appendDabPath(context, dab, strokeContext.target, scaleX, scaleY);
    }

    context.fill();
  } else {
    for (const dab of dabs) {
      context.beginPath();
      appendDabPath(context, dab, strokeContext.target, scaleX, scaleY);
      context.fill();
    }
  }

  context.restore();
};

const appendDabPath = (
  context: CanvasRenderingContext2D,
  dab: RasterDab,
  target: Readonly<RasterTarget>,
  scaleX: number,
  scaleY: number
) => {
  const x = (dab.center.x - target.bounds.x) * scaleX;
  const y = (dab.center.y - target.bounds.y) * scaleY;
  const radiusX = (dab.size * scaleX) / 2;
  const radiusY = (dab.size * scaleY) / 2;

  context.moveTo(x + radiusX, y);

  if (Math.abs(radiusX - radiusY) < 1e-9) {
    context.arc(x, y, radiusX, 0, Math.PI * 2);
  } else {
    context.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  }
};

const getDabsDirtyRegion = (
  dabs: readonly RasterDab[],
  target: Readonly<RasterTarget>
) => {
  let region: RasterDirtyRegion | null = null;
  const scaleX = target.pixelSize.width / target.bounds.width;
  const scaleY = target.pixelSize.height / target.bounds.height;

  for (const dab of dabs) {
    const centerX = (dab.center.x - target.bounds.x) * scaleX;
    const centerY = (dab.center.y - target.bounds.y) * scaleY;
    const radiusX = (dab.size * scaleX) / 2;
    const radiusY = (dab.size * scaleY) / 2;
    const minX = Math.max(0, Math.floor(centerX - radiusX));
    const minY = Math.max(0, Math.floor(centerY - radiusY));
    const maxX = Math.min(target.pixelSize.width, Math.ceil(centerX + radiusX));
    const maxY = Math.min(
      target.pixelSize.height,
      Math.ceil(centerY + radiusY)
    );

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

const assertHardRoundDabs = (dabs: readonly RasterDab[]) => {
  if (dabs.some((dab) => dab.tip.kind !== "round" || dab.hardness !== 1)) {
    throw new Error("Canvas2D vertical slice supports Hard Round dabs only");
  }
};
