import type { VectorContourDocument } from "@punchpress/punch-schema";

export interface VectorEndpointDragTarget {
  behavior: "close-contour" | "snap-endpoint";
  contourIndex: number;
  point: { x: number; y: number };
  segmentIndex: number;
}

interface VectorPathPoint {
  contourIndex: number;
  segmentIndex: number;
}

interface FinalizeVectorEndpointDragResult {
  contours: VectorContourDocument[];
  primaryPoint: VectorPathPoint | null;
  selectedPoints: VectorPathPoint[];
}

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

export const getVectorEndpointSnapTargets = (
  contours: VectorContourDocument[],
  {
    contourIndex,
    segmentIndex,
  }: {
    contourIndex: number;
    segmentIndex: number;
  }
) => {
  const sourceContour = contours[contourIndex];

  if (
    !(
      sourceContour &&
      !sourceContour.closed &&
      sourceContour.segments.length > 1
    )
  ) {
    return [];
  }

  const isSourceEndpoint =
    segmentIndex === 0 || segmentIndex === sourceContour.segments.length - 1;

  if (!isSourceEndpoint) {
    return [];
  }

  return contours.flatMap((contour, currentContourIndex) => {
    if (!(contour && !contour.closed && contour.segments.length > 0)) {
      return [];
    }

    if (currentContourIndex === contourIndex) {
      const closeTarget = getVectorEndpointCloseTarget(contours, {
        contourIndex,
        segmentIndex,
      });

      return closeTarget ? [closeTarget] : [];
    }

    const leadingTarget = contour.segments[0];
    const trailingTarget = contour.segments.at(-1);

    return [
      leadingTarget
        ? {
            contourIndex: currentContourIndex,
            point: cloneHandle(leadingTarget.point),
            segmentIndex: 0,
          }
        : null,
      trailingTarget
        ? {
            contourIndex: currentContourIndex,
            point: cloneHandle(trailingTarget.point),
            segmentIndex: contour.segments.length - 1,
          }
        : null,
    ].filter(Boolean);
  });
};

export const resolveVectorEndpointDragTarget = (
  contours: VectorContourDocument[],
  sourcePoint: {
    contourIndex: number;
    segmentIndex: number;
  },
  draggedCanvasPoint: { x: number; y: number },
  {
    projectPoint,
    snapDistancePx,
  }: {
    projectPoint: (point: { x: number; y: number }) => {
      x: number;
      y: number;
    };
    snapDistancePx: number;
  }
): VectorEndpointDragTarget | null => {
  const endpointSnapTargets = getVectorEndpointSnapTargets(
    contours,
    sourcePoint
  );

  if (endpointSnapTargets.length === 0) {
    return null;
  }

  let nextTarget: VectorEndpointDragTarget | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const endpointSnapTarget of endpointSnapTargets) {
    const projectedTargetPoint = projectPoint(endpointSnapTarget.point);
    const candidateDistance = Math.hypot(
      projectedTargetPoint.x - draggedCanvasPoint.x,
      projectedTargetPoint.y - draggedCanvasPoint.y
    );

    if (
      !shouldSnapVectorEndpointClose(
        projectedTargetPoint,
        draggedCanvasPoint,
        snapDistancePx
      ) ||
      candidateDistance >= closestDistance
    ) {
      continue;
    }

    closestDistance = candidateDistance;
    nextTarget = {
      ...endpointSnapTarget,
      behavior:
        endpointSnapTarget.contourIndex === sourcePoint.contourIndex
          ? "close-contour"
          : "snap-endpoint",
    };
  }

  return nextTarget;
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

  if (!endpointCloseTarget) {
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

export const finalizeVectorEndpointDrag = (
  contours: VectorContourDocument[],
  sourcePoint: VectorPathPoint,
  target: VectorEndpointDragTarget | null
): FinalizeVectorEndpointDragResult | null => {
  if (!target) {
    return null;
  }

  if (target.behavior === "close-contour") {
    const closeResult = closeVectorContourByDraggingEndpoint(contours, {
      contourIndex: sourcePoint.contourIndex,
      draggedSegmentIndex: sourcePoint.segmentIndex,
      targetSegmentIndex: target.segmentIndex,
    });

    return {
      contours: closeResult.contours,
      primaryPoint: closeResult.selectedPoint,
      selectedPoints: closeResult.selectedPoint
        ? [closeResult.selectedPoint]
        : [],
    };
  }

  return {
    contours,
    primaryPoint: null,
    selectedPoints: [
      {
        contourIndex: sourcePoint.contourIndex,
        segmentIndex: sourcePoint.segmentIndex,
      },
      {
        contourIndex: target.contourIndex,
        segmentIndex: target.segmentIndex,
      },
    ],
  };
};
