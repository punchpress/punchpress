export type RasterPoint = {
  x: number;
  y: number;
};

export type RasterBrushTip =
  | { kind: "round" }
  | { kind: "sampled"; sampleId: string };

export type RasterStrokeSettings = {
  color: string;
  hardness: number;
  opacity: number;
  size: number;
  smoothing: number;
  spacing: number;
  tip: RasterBrushTip;
};

export type RasterDab = {
  center: RasterPoint;
  color: string;
  hardness: number;
  opacity: number;
  size: number;
  tip: RasterBrushTip;
};

export type RasterOperation = "erase" | "paint";

export type RasterRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type RasterPixelSize = {
  height: number;
  width: number;
};

export type RasterTarget = {
  bounds: RasterRect;
  id: string;
  pixelSize: RasterPixelSize;
};

export type RasterStrokeContext = {
  readonly operation: RasterOperation;
  readonly settings: Readonly<Omit<RasterStrokeSettings, "tip">> & {
    readonly tip: Readonly<RasterBrushTip>;
  };
  readonly target: Readonly<Omit<RasterTarget, "bounds" | "pixelSize">> & {
    readonly bounds: Readonly<RasterRect>;
    readonly pixelSize: Readonly<RasterPixelSize>;
  };
};

export type RasterDirtyRegion = RasterRect;

export type RasterCommit = {
  dirtyRegion: RasterDirtyRegion | null;
  targetId: string;
};

export type RasterSurfaceSession = {
  applyDabs: (dabs: readonly RasterDab[]) => void;
  cancel: () => void;
  commit: () => RasterCommit;
};

export type RasterSurface = {
  beginStroke: (context: Readonly<RasterStrokeContext>) => RasterSurfaceSession;
};

export type RasterSurfaceResolver = {
  retainTargets?: (targetIds: readonly string[]) => void;
  resolveSurface: (target: Readonly<RasterTarget>) => RasterSurface | null;
};
