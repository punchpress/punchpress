import type {
  VectorContourDocument,
  VectorHandleDocument,
  VectorPointTypeDocument,
} from "@punchpress/punch-schema";

const HANDLE_EPSILON = 0.01;

const getHandleLength = (handle: VectorHandleDocument) => {
  return Math.hypot(handle.x, handle.y);
};

const isZeroHandle = (handle: VectorHandleDocument) => {
  return getHandleLength(handle) <= HANDLE_EPSILON;
};

const normalizeHandle = (handle: VectorHandleDocument) => {
  const length = getHandleLength(handle);

  if (length <= HANDLE_EPSILON) {
    return null;
  }

  return {
    x: handle.x / length,
    y: handle.y / length,
  };
};

const scaleHandle = (direction: VectorHandleDocument, length: number) => {
  return {
    x: direction.x * length,
    y: direction.y * length,
  };
};

const invertHandle = (handle: VectorHandleDocument) => {
  return {
    x: -handle.x,
    y: -handle.y,
  };
};

const getNeighborPoint = (
  contour: VectorContourDocument,
  segmentIndex: number,
  offset: -1 | 1
) => {
  const nextIndex = segmentIndex + offset;

  if (nextIndex >= 0 && nextIndex < contour.segments.length) {
    return contour.segments[nextIndex]?.point || null;
  }

  if (!contour.closed || contour.segments.length < 2) {
    return null;
  }

  return offset === -1
    ? contour.segments.at(-1)?.point || null
    : contour.segments[0]?.point || null;
};

const getDefaultSmoothHandleLength = (
  contour: VectorContourDocument,
  segmentIndex: number
) => {
  const segment = contour.segments[segmentIndex];

  if (!segment) {
    return 24;
  }

  const distances = [getNeighborPoint(contour, segmentIndex, -1), getNeighborPoint(contour, segmentIndex, 1)]
    .filter(Boolean)
    .map((point) => {
      return Math.hypot(point.x - segment.point.x, point.y - segment.point.y);
    });

  if (distances.length === 0) {
    return 24;
  }

  return Math.max(
    distances.reduce((total, distance) => total + distance, 0) /
      distances.length /
      3,
    12
  );
};

const getSmoothAxis = (
  contour: VectorContourDocument,
  segmentIndex: number,
  fallbackHandle?: VectorHandleDocument
) => {
  const segment = contour.segments[segmentIndex];

  if (!segment) {
    return { x: 1, y: 0 };
  }

  const normalizedFallback = fallbackHandle
    ? normalizeHandle(fallbackHandle)
    : null;

  if (normalizedFallback) {
    return normalizedFallback;
  }

  const existingOut = normalizeHandle(segment.handleOut);

  if (existingOut) {
    return existingOut;
  }

  const existingIn = normalizeHandle(segment.handleIn);

  if (existingIn) {
    return invertHandle(existingIn);
  }

  const previousPoint = getNeighborPoint(contour, segmentIndex, -1);
  const nextPoint = getNeighborPoint(contour, segmentIndex, 1);

  if (previousPoint && nextPoint) {
    const tangent = normalizeHandle({
      x: nextPoint.x - previousPoint.x,
      y: nextPoint.y - previousPoint.y,
    });

    if (tangent) {
      return tangent;
    }
  }

  if (nextPoint) {
    const tangent = normalizeHandle({
      x: nextPoint.x - segment.point.x,
      y: nextPoint.y - segment.point.y,
    });

    if (tangent) {
      return tangent;
    }
  }

  if (previousPoint) {
    const tangent = normalizeHandle({
      x: segment.point.x - previousPoint.x,
      y: segment.point.y - previousPoint.y,
    });

    if (tangent) {
      return tangent;
    }
  }

  return { x: 1, y: 0 };
};

const mapTargetSegment = (
  contours: VectorContourDocument[],
  target: {
    contourIndex: number;
    segmentIndex: number;
  },
  mapper: (
    segment: VectorContourDocument["segments"][number],
    contour: VectorContourDocument
  ) => VectorContourDocument["segments"][number]
) => {
  return contours.map((contour, contourIndex) => {
    if (contourIndex !== target.contourIndex) {
      return contour;
    }

    return {
      ...contour,
      segments: contour.segments.map((segment, segmentIndex) => {
        if (segmentIndex !== target.segmentIndex) {
          return segment;
        }

        return mapper(segment, contour);
      }),
    };
  });
};

export const setVectorPointType = (
  contours: VectorContourDocument[],
  target: {
    contourIndex: number;
    pointType: VectorPointTypeDocument;
    segmentIndex: number;
  }
) => {
  return mapTargetSegment(contours, target, (segment, contour) => {
    if (target.pointType === "corner") {
      return {
        ...segment,
        pointType: "corner",
      };
    }

    const axis = getSmoothAxis(contour, target.segmentIndex);
    const handleOutLength = isZeroHandle(segment.handleOut)
      ? getDefaultSmoothHandleLength(contour, target.segmentIndex)
      : getHandleLength(segment.handleOut);
    const handleInLength = isZeroHandle(segment.handleIn)
      ? handleOutLength
      : getHandleLength(segment.handleIn);

    return {
      ...segment,
      handleIn: scaleHandle(invertHandle(axis), handleInLength),
      handleOut: scaleHandle(axis, handleOutLength),
      pointType: "smooth",
    };
  });
};

export const updateVectorPointHandle = (
  contours: VectorContourDocument[],
  target: {
    contourIndex: number;
    handleRole: "handleIn" | "handleOut";
    segmentIndex: number;
    value: VectorHandleDocument;
  }
) => {
  return mapTargetSegment(contours, target, (segment, contour) => {
    const nextSegment = {
      ...segment,
      [target.handleRole]: target.value,
    };

    if (segment.pointType !== "smooth") {
      return nextSegment;
    }

    const oppositeRole =
      target.handleRole === "handleOut" ? "handleIn" : "handleOut";
    const oppositeLength = getHandleLength(segment[oppositeRole]);

    if (oppositeLength <= HANDLE_EPSILON || isZeroHandle(target.value)) {
      return nextSegment;
    }

    const axis = getSmoothAxis(contour, target.segmentIndex, target.value);

    return {
      ...nextSegment,
      [oppositeRole]: scaleHandle(
        target.handleRole === "handleOut" ? invertHandle(axis) : axis,
        oppositeLength
      ),
    };
  });
};
