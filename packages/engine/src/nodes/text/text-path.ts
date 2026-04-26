import { clamp, format } from "../../primitives/math";
import { getBounds, mapContours } from "../../primitives/path-geometry";
import { WAVE_CYCLES_MIN } from "./model";

const ARCH_GUIDE_SAMPLES = 16;
const POSITION_HANDLE_OFFSET = 28;
const WAVE_GUIDE_SAMPLES = 32;

const unionBounds = (a, b) => {
  return {
    height: Math.max(a.maxY, b.maxY) - Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    width: Math.max(a.maxX, b.maxX) - Math.min(a.minX, b.minX),
  };
};

const getPointBounds = (points) => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    height: Math.max(...ys) - Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
  };
};

export const normalizeLoop = (value) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const normalized = value % 1;
  return normalized < 0 ? normalized + 1 : normalized;
};

export const normalizeAngleDeg = (value) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

export const getCircleCenterAngleDeg = (warp) => {
  return normalizeLoop(warp.pathPosition) * 360;
};

const buildGuidePathD = (points) => {
  if (points.length === 0) {
    return "";
  }

  return points
    .map((point, index) => {
      return `${index === 0 ? "M" : "L"} ${format(point.x)} ${format(point.y)}`;
    })
    .join(" ");
};

const getArchGuidePoint = (
  bounds,
  bend,
  t,
  baseY = (bounds.minY + bounds.maxY) / 2
) => {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const halfWidth = Math.max(bounds.width / 2, 1);
  const halfHeight = Math.max(bounds.height / 2, 1);
  const u = t * 2 - 1;

  return {
    x: centerX + u * halfWidth,
    y: baseY + bend * (1 - u * u) * halfHeight,
  };
};

export const getArchGuide = (bounds, bend, contentBounds = bounds) => {
  const points = Array.from({ length: ARCH_GUIDE_SAMPLES + 1 }, (_, index) => {
    return getArchGuidePoint(bounds, bend, index / ARCH_GUIDE_SAMPLES);
  });
  const centerPoint = getArchGuidePoint(bounds, bend, 0.5);
  const guideBounds = getPointBounds(points);

  return {
    activePathD: buildGuidePathD(points),
    bendScale: Math.max(bounds.height / 3, 1),
    bounds: unionBounds(contentBounds, guideBounds),
    handles: [
      {
        key: "bend",
        point: {
          x: centerPoint.x,
          y: centerPoint.y,
        },
        role: "bend",
      },
    ],
    kind: "arch",
    pathD: buildGuidePathD(points),
  };
};

export const getSlantGuide = (bounds, rise, contentBounds = bounds) => {
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const halfRise = rise / 2;
  const leftPoint = {
    x: bounds.minX,
    y: centerY - halfRise,
  };
  const rightPoint = {
    x: bounds.maxX,
    y: centerY + halfRise,
  };
  const guideBounds = getPointBounds([leftPoint, rightPoint]);

  return {
    activePathD: buildGuidePathD([leftPoint, rightPoint]),
    bounds: unionBounds(contentBounds, guideBounds),
    handles: [
      {
        key: "slant",
        point: rightPoint,
        role: "slant",
      },
    ],
    kind: "slant",
    pathD: buildGuidePathD([leftPoint, rightPoint]),
    slantVector: {
      x: rightPoint.x - leftPoint.x,
      y: rightPoint.y - leftPoint.y,
    },
    topHandleOffsetY: bounds.minY - centerY,
  };
};

const getWaveGuidePoint = (
  bounds,
  amplitude,
  cycles,
  t,
  baseY = (bounds.minY + bounds.maxY) / 2
) => {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const halfWidth = Math.max(bounds.width / 2, 1);
  const u = t * 2 - 1;

  return {
    x: centerX + u * halfWidth,
    y: baseY + amplitude * Math.sin(2 * Math.PI * cycles * t),
  };
};

const getWaveExtremumTs = (cycles) => {
  const safeCycles = Math.max(Math.abs(cycles), WAVE_CYCLES_MIN);
  const extremumCount = Math.max(Math.ceil(safeCycles * 2) + 2, 2);
  const ts: number[] = [];

  for (let index = 0; index < extremumCount; index += 1) {
    const t = (1 + index * 2) / (4 * safeCycles);

    if (t >= 0 && t <= 1) {
      ts.push(t);
    }
  }

  return ts.length > 0 ? ts : [0.5];
};

const getCenterWaveExtremumT = (cycles) => {
  return getWaveExtremumTs(cycles).reduce((best, t) => {
    const distanceToCenter = Math.abs(t - 0.5);
    const bestDistance = Math.abs(best - 0.5);

    if (distanceToCenter < bestDistance) {
      return t;
    }

    if (distanceToCenter === bestDistance && t > best) {
      return t;
    }

    return best;
  }, 0.5);
};

const getRightWaveExtremumT = (cycles) => {
  return getWaveExtremumTs(cycles).reduce((best, t) => {
    return t > best ? t : best;
  }, 0.5);
};

export const getWaveGuide = (
  bounds,
  amplitude,
  cycles,
  contentBounds = bounds
) => {
  const points = Array.from({ length: WAVE_GUIDE_SAMPLES + 1 }, (_, index) => {
    return getWaveGuidePoint(
      bounds,
      amplitude,
      cycles,
      index / WAVE_GUIDE_SAMPLES
    );
  });
  const guideBounds = getPointBounds(points);
  const centerHandlePoint = getWaveGuidePoint(bounds, amplitude, cycles, 0.5);
  const cyclesPoint = getWaveGuidePoint(
    bounds,
    amplitude,
    cycles,
    getCenterWaveExtremumT(cycles)
  );
  const amplitudePoint = getWaveGuidePoint(
    bounds,
    amplitude,
    cycles,
    getRightWaveExtremumT(cycles)
  );

  return {
    activePathD: buildGuidePathD(points),
    bounds: unionBounds(contentBounds, guideBounds),
    cycleScale: Math.max(bounds.width / 2, 1),
    handles: [
      {
        key: "cycles",
        point: cyclesPoint,
        role: "cycles",
      },
      {
        key: "amplitude",
        point: amplitudePoint,
        role: "amplitude",
      },
    ],
    handleAnchorPoint: centerHandlePoint,
    kind: "wave",
    pathD: buildGuidePathD(points),
  };
};

export const getCirclePoint = (radius, angleDeg) => {
  const angleRad = (angleDeg * Math.PI) / 180;

  return {
    x: radius * Math.sin(angleRad),
    y: radius - radius * Math.cos(angleRad),
  };
};

const buildCirclePathD = (radius) => {
  return [
    `M 0 ${format(0)}`,
    `A ${format(radius)} ${format(radius)} 0 1 1 0 ${format(radius * 2)}`,
    `A ${format(radius)} ${format(radius)} 0 1 1 0 ${format(0)}`,
  ].join(" ");
};

const buildCircleArcPathD = (radius, startAngleDeg, sweepDeg) => {
  const absoluteSweep = Math.abs(sweepDeg);

  if (absoluteSweep <= 0.001) {
    const point = getCirclePoint(radius, startAngleDeg);
    return `M ${format(point.x)} ${format(point.y)}`;
  }

  if (absoluteSweep >= 359.999) {
    return buildCirclePathD(radius);
  }

  const start = getCirclePoint(radius, startAngleDeg);
  const end = getCirclePoint(radius, startAngleDeg + sweepDeg);

  return [
    `M ${format(start.x)} ${format(start.y)}`,
    `A ${format(radius)} ${format(radius)} 0 ${absoluteSweep > 180 ? 1 : 0} ${
      sweepDeg >= 0 ? 1 : 0
    } ${format(end.x)} ${format(end.y)}`,
  ].join(" ");
};

export const getCircleGuide = (warp) => {
  const radius = Math.max(1, warp.radius);
  const centerAngleDeg = getCircleCenterAngleDeg(warp);

  return {
    activePathD: buildCircleArcPathD(
      radius,
      centerAngleDeg - warp.sweepDeg / 2,
      warp.sweepDeg
    ),
    bounds: {
      height: radius * 2,
      maxX: radius,
      maxY: radius * 2,
      minX: -radius,
      minY: 0,
      width: radius * 2,
    },
    center: {
      x: 0,
      y: radius,
    },
    centerAngleDeg,
    handles: [
      {
        key: "position",
        point: getCirclePoint(radius + POSITION_HANDLE_OFFSET, centerAngleDeg),
        role: "position",
      },
    ],
    kind: "circle",
    pathD: buildCirclePathD(radius),
    radius,
  };
};

export const getCirclePointAngleDeg = (guide, point) => {
  return normalizeAngleDeg(
    (Math.atan2(point.x - guide.center.x, guide.center.y - point.y) * 180) /
      Math.PI
  );
};

export const buildCircleTextGeometry = (layout, node) => {
  const guide = getCircleGuide(node.warp);
  const paths =
    /** @type {Array<{ d: string, key: string, transform?: string }>} */ ([]);
  const mergedContours = /** @type {ReturnType<typeof mapContours>} */ ([]);
  const totalWidth = Math.max(layout.totalWidth, 1);

  for (const [index, glyph] of layout.glyphs.entries()) {
    const centerX = glyph.baseX + glyph.advance / 2;
    const u = clamp((centerX + totalWidth / 2) / totalWidth, 0, 1);
    const angleDeg = guide.centerAngleDeg + (u - 0.5) * node.warp.sweepDeg;
    const point = getCirclePoint(guide.radius, angleDeg);

    paths.push({
      key: `glyph-${index}`,
      d: glyph.path,
      transform: `translate(${format(point.x)} ${format(
        point.y
      )}) rotate(${format(angleDeg)}) translate(${format(-glyph.centerX)} 0)`,
    });

    mergedContours.push(
      ...mapContours(glyph.contours, (contourPoint) => {
        const shiftedX = contourPoint.x - glyph.centerX;
        const shiftedY = contourPoint.y;
        const angleRad = (angleDeg * Math.PI) / 180;
        const rotatedX =
          shiftedX * Math.cos(angleRad) - shiftedY * Math.sin(angleRad);
        const rotatedY =
          shiftedX * Math.sin(angleRad) + shiftedY * Math.cos(angleRad);

        return {
          x: rotatedX + point.x,
          y: rotatedY + point.y,
        };
      })
    );
  }

  const bbox = getBounds(mergedContours);

  return {
    bbox,
    guide,
    paths,
    selectionBounds: unionBounds(bbox, guide.bounds),
  };
};
