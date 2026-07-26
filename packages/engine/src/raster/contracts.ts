export type RasterPoint = {
  x: number;
  y: number;
};

export type RasterBrushTip =
  | { kind: "round" }
  | { kind: "sampled"; sampleId: string };

export type RasterStrokeSettings = {
  angle: number;
  angleJitter: number;
  color: string;
  flow: number;
  hardness: number;
  opacity: number;
  roundness: number;
  scatter: number;
  seed: number;
  size: number;
  sizeJitter: number;
  smoothing: number;
  spacing: number;
  tip: RasterBrushTip;
};

export type RasterDab = {
  angle: number;
  center: RasterPoint;
  color: string;
  flow: number;
  hardness: number;
  opacity: number;
  roundness: number;
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
  writableBounds?: RasterRect;
  writablePolygon?: readonly RasterPoint[];
};

export type RasterStrokeContext = {
  readonly operation: RasterOperation;
  readonly settings: Readonly<Omit<RasterStrokeSettings, "tip">> & {
    readonly tip: Readonly<RasterBrushTip>;
  };
  readonly target: Readonly<Omit<RasterTarget, "bounds" | "pixelSize">> & {
    readonly bounds: Readonly<RasterRect>;
    readonly pixelSize: Readonly<RasterPixelSize>;
    readonly writableBounds?: Readonly<RasterRect>;
    readonly writablePolygon?: readonly Readonly<RasterPoint>[];
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
  snapshotSurface?: (
    targetId: string
  ) => { height: number; src: string; width: number } | null;
  retainTargets?: (targetIds: readonly string[]) => void;
  resolveSurface: (target: Readonly<RasterTarget>) => RasterSurface | null;
};
