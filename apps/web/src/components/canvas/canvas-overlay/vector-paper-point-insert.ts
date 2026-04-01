const INSERT_HIT_TEST_OPTIONS = {
  fill: false,
  stroke: true,
  tolerance: 10,
};

const HANDLE_EPSILON = 0.01;

const getHandleLength = (handle) => {
  return Math.hypot(handle.x, handle.y);
};

const getPointType = (segment) => {
  return getHandleLength(segment.handleIn) > HANDLE_EPSILON ||
    getHandleLength(segment.handleOut) > HANDLE_EPSILON
    ? "smooth"
    : "corner";
};

const toDocumentHandle = (point) => {
  return {
    x: point.x,
    y: point.y,
  };
};

const toDocumentSegment = (segment, pointType, previousSegment) => {
  return {
    cornerRadius: previousSegment?.cornerRadius,
    handleIn: toDocumentHandle(segment.handleIn),
    handleOut: toDocumentHandle(segment.handleOut),
    point: toDocumentHandle(segment.point),
    pointType,
  };
};

export const createLocalContourPath = (scope, contour) => {
  const path = new scope.Path({
    closed: contour.closed,
    insert: false,
    strokeColor: "black",
    strokeWidth: 1,
  });

  contour.segments.forEach((segment) => {
    path.add(
      new scope.Segment(
        new scope.Point(segment.point.x, segment.point.y),
        new scope.Point(segment.handleIn.x, segment.handleIn.y),
        new scope.Point(segment.handleOut.x, segment.handleOut.y)
      )
    );
  });

  return path;
};

export const findVectorPathInsertTarget = (paths, point) => {
  for (const path of paths) {
    const hit = path.hitTest(point, INSERT_HIT_TEST_OPTIONS);

    if (hit?.location) {
      return {
        contourIndex: path.data.contourIndex,
        curveIndex: hit.location.curve.index,
        offset: hit.location.offset,
      };
    }
  }

  return null;
};

export const splitVectorContourAtOffset = (scope, contour, target) => {
  const path = createLocalContourPath(scope, contour);
  const insertedSegment = path.divideAt(target.offset);

  if (!insertedSegment) {
    return null;
  }

  const insertedIndex = path.segments.indexOf(insertedSegment);

  return {
    contourIndex: target.contourIndex,
    segmentIndex: insertedIndex,
    segments: path.segments.map((segment, index) => {
      if (index < insertedIndex) {
        return toDocumentSegment(
          segment,
          contour.segments[index]?.pointType || "corner",
          contour.segments[index]
        );
      }

      if (index > insertedIndex) {
        return toDocumentSegment(
          segment,
          contour.segments[index - 1]?.pointType || "corner",
          contour.segments[index - 1]
        );
      }

      return toDocumentSegment(segment, getPointType(segment));
    }),
  };
};
