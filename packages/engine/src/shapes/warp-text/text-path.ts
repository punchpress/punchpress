import { clamp, format } from "../../primitives/math";
import { getBounds, mapContours } from "../../primitives/path-geometry";

const POSITION_HANDLE_OFFSET = 28;

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
