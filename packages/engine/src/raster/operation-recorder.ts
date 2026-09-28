import type {
  RasterCommit,
  RasterDab,
  RasterDirtyRegion,
  RasterStrokeContext,
  RasterSurface,
} from "./contracts";

export type RecordedRasterCommit = {
  context: RasterStrokeContext;
  dabs: RasterDab[];
  dirtyRegion: RasterDirtyRegion | null;
};

export type RasterOperationRecorder = RasterSurface & {
  commits: RecordedRasterCommit[];
};

export const createRasterOperationRecorder = (): RasterOperationRecorder => {
  const commits: RecordedRasterCommit[] = [];

  return {
    beginStroke: (context) => {
      const dabs: RasterDab[] = [];
      let active = true;

      const requireActive = () => {
        if (!active) {
          throw new Error("Raster surface session is already complete");
        }
      };

      return {
        applyDabs: (nextDabs) => {
          requireActive();
          dabs.push(...nextDabs.map(cloneDab));
        },
        cancel: () => {
          requireActive();
          active = false;
        },
        commit: () => {
          requireActive();
          active = false;

          const dirtyRegion = getDirtyRegion(context.target, dabs);
          const recordedCommit = {
            context: cloneContext(context),
            dabs: dabs.map(cloneDab),
            dirtyRegion,
          };

          commits.push(recordedCommit);
          return {
            dirtyRegion,
            targetId: context.target.id,
          } satisfies RasterCommit;
        },
      };
    },
    commits,
  };
};

const getDirtyRegion = (
  target: RasterStrokeContext["target"],
  dabs: readonly RasterDab[]
): RasterDirtyRegion | null => {
  if (dabs.length === 0) {
    return null;
  }

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
  let minX = target.pixelSize.width;
  let minY = target.pixelSize.height;
  let maxX = 0;
  let maxY = 0;

  for (const dab of dabs) {
    const radius = dab.size / 2;

    minX = Math.min(
      minX,
      Math.max(
        writableMinX,
        Math.floor((dab.center.x - radius - target.bounds.x) * scaleX)
      )
    );
    minY = Math.min(
      minY,
      Math.max(
        writableMinY,
        Math.floor((dab.center.y - radius - target.bounds.y) * scaleY)
      )
    );
    maxX = Math.max(
      maxX,
      Math.min(
        writableMaxX,
        Math.ceil((dab.center.x + radius - target.bounds.x) * scaleX)
      )
    );
    maxY = Math.max(
      maxY,
      Math.min(
        writableMaxY,
        Math.ceil((dab.center.y + radius - target.bounds.y) * scaleY)
      )
    );
  }

  if (maxX <= minX || maxY <= minY) {
    return null;
  }

  return {
    height: maxY - minY,
    width: maxX - minX,
    x: minX,
    y: minY,
  };
};

const cloneDab = (dab: RasterDab): RasterDab => ({
  ...dab,
  center: { ...dab.center },
  tip: { ...dab.tip },
});

const cloneContext = (
  context: Readonly<RasterStrokeContext>
): RasterStrokeContext => ({
  operation: context.operation,
  settings: {
    ...context.settings,
    tip: { ...context.settings.tip },
  },
    target: {
      ...context.target,
      bounds: { ...context.target.bounds },
      pixelSize: { ...context.target.pixelSize },
      writableBounds: context.target.writableBounds
        ? { ...context.target.writableBounds }
        : undefined,
      writablePolygon: context.target.writablePolygon?.map((point) => ({
        ...point,
      })),
    },
  });
