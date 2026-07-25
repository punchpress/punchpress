interface Bounds {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

interface DisplayPlane {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface Size {
  height: number;
  width: number;
}

interface Scale {
  x: number;
  y: number;
}

export const getExactRasterCanvasLayout = ({
  backingHeight,
  backingWidth,
  bounds,
}: {
  backingHeight: number;
  backingWidth: number;
  bounds: { height: number; width: number };
}) => {
  return {
    height: `${backingHeight}px`,
    transform: `scale(${bounds.width / backingWidth}, ${bounds.height / backingHeight})`,
    transformOrigin: "0 0",
    width: `${backingWidth}px`,
  };
};

export const getNativeRasterViewportPresentation = ({
  backingLimit,
  devicePixelRatio,
  display,
  sampleSize,
  screenScale,
  visibleBounds,
}: {
  backingLimit: Size;
  devicePixelRatio: number;
  display: DisplayPlane;
  sampleSize: Size;
  screenScale: Scale;
  visibleBounds: Bounds;
}) => {
  const cellWidth = display.width / sampleSize.width;
  const cellHeight = display.height / sampleSize.height;
  const bounds = {
    maxX: Math.min(display.x + display.width, visibleBounds.maxX),
    maxY: Math.min(display.y + display.height, visibleBounds.maxY),
    minX: Math.max(display.x, visibleBounds.minX),
    minY: Math.max(display.y, visibleBounds.minY),
  };

  if (!(bounds.maxX > bounds.minX && bounds.maxY > bounds.minY)) {
    return null;
  }

  const sourceX = clamp(
    Math.floor((bounds.minX - display.x) / cellWidth),
    0,
    sampleSize.width
  );
  const sourceY = clamp(
    Math.floor((bounds.minY - display.y) / cellHeight),
    0,
    sampleSize.height
  );
  const sourceMaxX = clamp(
    Math.ceil((bounds.maxX - display.x) / cellWidth),
    0,
    sampleSize.width
  );
  const sourceMaxY = clamp(
    Math.ceil((bounds.maxY - display.y) / cellHeight),
    0,
    sampleSize.height
  );
  const sourceWidth = sourceMaxX - sourceX;
  const sourceHeight = sourceMaxY - sourceY;

  if (!(sourceWidth > 0 && sourceHeight > 0)) {
    return null;
  }

  const physicalScale = Math.max(0.001, devicePixelRatio);
  const physicalScaleX = Math.max(0.001, screenScale.x * physicalScale);
  const physicalScaleY = Math.max(0.001, screenScale.y * physicalScale);
  const backingHeight = Math.min(
    Math.max(1, Math.round(backingLimit.height)),
    Math.max(1, Math.round((bounds.maxY - bounds.minY) * physicalScaleY))
  );
  const backingWidth = Math.min(
    Math.max(1, Math.round(backingLimit.width)),
    Math.max(1, Math.round((bounds.maxX - bounds.minX) * physicalScaleX))
  );
  const presentationBounds = {
    height: backingHeight / physicalScaleY,
    width: backingWidth / physicalScaleX,
    x: bounds.minX,
    y: bounds.minY,
  };

  return {
    backingHeight,
    backingWidth,
    bounds: presentationBounds,
    destination: {
      height: sourceHeight * cellHeight * physicalScaleY,
      width: sourceWidth * cellWidth * physicalScaleX,
      x:
        (display.x + sourceX * cellWidth - presentationBounds.x) *
        physicalScaleX,
      y:
        (display.y + sourceY * cellHeight - presentationBounds.y) *
        physicalScaleY,
    },
    sourceHeight,
    sourceWidth,
    sourceX,
    sourceY,
  };
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};
