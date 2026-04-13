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

const cloneHandle = (handle: VectorHandleDocument) => {
  return {
    x: handle.x,
    y: handle.y,
  };
};

const cloneSegment = (segment: VectorContourDocument["segments"][number]) => {
  return {
    ...segment,
    handleIn: cloneHandle(segment.handleIn),
    handleOut: cloneHandle(segment.handleOut),
    point: cloneHandle(segment.point),
  };
};

const constrainHandleAngle = (handle: VectorHandleDocument) => {
  const length = getHandleLength(handle);

  if (length <= HANDLE_EPSILON) {
    return handle;
  }

  const step = Math.PI / 4;
  const snappedAngle = Math.round(Math.atan2(handle.y, handle.x) / step) * step;
  const x = Math.cos(snappedAngle) * length;
  const y = Math.sin(snappedAngle) * length;

  return {
    x: Math.abs(x) <= HANDLE_EPSILON ? 0 : x,
    y: Math.abs(y) <= HANDLE_EPSILON ? 0 : y,
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

  const distances = [
    getNeighborPoint(contour, segmentIndex, -1),
    getNeighborPoint(contour, segmentIndex, 1),
  ]
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
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
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

export const authorVectorPointHandlesFromAnchorDrag = (
  contours: VectorContourDocument[],
  target: {
    constrainAngle?: boolean;
    contourIndex: number;
    segmentIndex: number;
    value: VectorHandleDocument;
  }
) => {
  return mapTargetSegment(contours, target, (segment) => {
    const nextHandle = target.constrainAngle
      ? constrainHandleAngle(target.value)
      : target.value;

    if (isZeroHandle(nextHandle)) {
      return {
        ...segment,
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        pointType: "corner",
      };
    }

    return {
      ...segment,
      handleIn: invertHandle(nextHandle),
      handleOut: nextHandle,
      pointType: "smooth",
    };
  });
};

export const updateVectorPointHandle = (
  contours: VectorContourDocument[],
  target: {
    constrainAngle?: boolean;
    contourIndex: number;
    handleRole: "handleIn" | "handleOut";
    preserveSmoothCoupling?: boolean;
    segmentIndex: number;
    value: VectorHandleDocument;
  }
) => {
  return mapTargetSegment(contours, target, (segment, contour) => {
    const nextValue = target.constrainAngle
      ? constrainHandleAngle(target.value)
      : target.value;
    const nextSegment = {
      ...segment,
      [target.handleRole]: nextValue,
    };

    if (segment.pointType !== "smooth") {
      return nextSegment;
    }

    if (target.preserveSmoothCoupling === false) {
      return {
        ...nextSegment,
        pointType: "corner",
      };
    }

    const oppositeRole =
      target.handleRole === "handleOut" ? "handleIn" : "handleOut";
    const oppositeLength = getHandleLength(segment[oppositeRole]);

    if (oppositeLength <= HANDLE_EPSILON || isZeroHandle(nextValue)) {
      return nextSegment;
    }

    const axis = getSmoothAxis(contour, target.segmentIndex, nextValue);

    return {
      ...nextSegment,
      [oppositeRole]: scaleHandle(invertHandle(axis), oppositeLength),
    };
  });
};

export const deleteVectorPoint = (
  contours: VectorContourDocument[],
  target: {
    contourIndex: number;
    segmentIndex: number;
  }
) => {
  const contour = contours[target.contourIndex];

  if (!contour?.segments[target.segmentIndex]) {
    return {
      contours,
      selectedPoint: null,
    };
  }

  const nextSegments = contour.segments
    .filter((_, segmentIndex) => {
      return segmentIndex !== target.segmentIndex;
    })
    .map(cloneSegment);
  const nextContours = contours.flatMap((currentContour, contourIndex) => {
    if (contourIndex !== target.contourIndex) {
      return [currentContour];
    }

    if (nextSegments.length === 0) {
      return [];
    }

    return [
      {
        ...currentContour,
        segments: nextSegments,
      },
    ];
  });

  return {
    contours: nextContours,
    selectedPoint:
      nextSegments.length > 0
        ? {
            contourIndex: target.contourIndex,
            segmentIndex: Math.min(
              target.segmentIndex,
              nextSegments.length - 1
            ),
          }
        : null,
  };
};
