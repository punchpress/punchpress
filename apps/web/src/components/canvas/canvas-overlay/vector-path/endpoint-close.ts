import type { VectorContourDocument } from "@punchpress/punch-schema";

const cloneHandle = (handle) => {
  return {
    x: handle.x,
    y: handle.y,
  };
};

const cloneSegment = (segment) => {
  return {
    ...segment,
    handleIn: cloneHandle(segment.handleIn),
    handleOut: cloneHandle(segment.handleOut),
    point: cloneHandle(segment.point),
  };
};

export const getVectorEndpointCloseTarget = (
  contours: VectorContourDocument[],
  {
    contourIndex,
    segmentIndex,
  }: {
    contourIndex: number;
    segmentIndex: number;
  }
) => {
  const contour = contours[contourIndex];

  if (!(contour && !contour.closed && contour.segments.length > 1)) {
    return null;
  }

  if (segmentIndex === 0) {
    const targetSegmentIndex = contour.segments.length - 1;
    return {
      contourIndex,
      point: cloneHandle(contour.segments[targetSegmentIndex].point),
      segmentIndex: targetSegmentIndex,
    };
  }

  if (segmentIndex === contour.segments.length - 1) {
    return {
      contourIndex,
      point: cloneHandle(contour.segments[0].point),
      segmentIndex: 0,
    };
  }

  return null;
};

export const shouldSnapVectorEndpointClose = (
  targetPoint: { x: number; y: number },
  draggedPoint: { x: number; y: number },
  snapDistancePx: number
) => {
  return (
    Math.hypot(
      targetPoint.x - draggedPoint.x,
      targetPoint.y - draggedPoint.y
    ) <= snapDistancePx
  );
};

export const getVectorDraggedEndpointPreviewPoint = (
  contours: VectorContourDocument[],
  {
    contourIndex,
    segmentIndex,
  }: {
    contourIndex: number;
    segmentIndex: number;
  },
  draggedPoint: { x: number; y: number },
  endpointCloseTarget: {
    contourIndex: number;
    point: { x: number; y: number };
    segmentIndex: number;
  } | null
) => {
  const currentPoint = contours[contourIndex]?.segments[segmentIndex]?.point;

  if (!currentPoint) {
    return draggedPoint;
  }

  if (
    !endpointCloseTarget ||
    endpointCloseTarget.contourIndex !== contourIndex
  ) {
    return draggedPoint;
  }

  return {
    x: endpointCloseTarget.point.x,
    y: endpointCloseTarget.point.y,
  };
};

export const closeVectorContourByDraggingEndpoint = (
  contours: VectorContourDocument[],
  {
    contourIndex,
    draggedSegmentIndex,
    targetSegmentIndex,
  }: {
    contourIndex: number;
    draggedSegmentIndex: number;
    targetSegmentIndex: number;
  }
) => {
  const contour = contours[contourIndex];

  if (!(contour && !contour.closed && contour.segments.length > 1)) {
    return {
      contours,
      selectedPoint: null,
    };
  }

  const draggedSegment = contour.segments[draggedSegmentIndex];
  const targetSegment = contour.segments[targetSegmentIndex];

  if (!(draggedSegment && targetSegment)) {
    return {
      contours,
      selectedPoint: null,
    };
  }

  const nextSegments = contour.segments
    .map((segment, currentSegmentIndex) => {
      if (currentSegmentIndex !== targetSegmentIndex) {
        return cloneSegment(segment);
      }

      if (targetSegmentIndex === 0) {
        return {
          ...cloneSegment(segment),
          handleIn: cloneHandle(draggedSegment.handleIn),
          pointType: "corner",
        };
      }

      return {
        ...cloneSegment(segment),
        handleOut: cloneHandle(draggedSegment.handleOut),
        pointType: "corner",
      };
    })
    .filter((_segment, currentSegmentIndex) => {
      return currentSegmentIndex !== draggedSegmentIndex;
    });

  const nextTargetSegmentIndex =
    draggedSegmentIndex > targetSegmentIndex
      ? targetSegmentIndex
      : targetSegmentIndex - 1;

  return {
    contours: contours.map((currentContour, currentContourIndex) => {
      if (currentContourIndex !== contourIndex) {
        return currentContour;
      }

      return {
        ...currentContour,
        closed: true,
        segments: nextSegments,
      };
    }),
    selectedPoint: {
      contourIndex,
      segmentIndex: nextTargetSegmentIndex,
    },
  };
};
