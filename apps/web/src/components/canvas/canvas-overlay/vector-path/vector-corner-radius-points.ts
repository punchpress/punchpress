import {
  getStableVectorCornerRadiusMax,
  getVectorPointCornerControl,
} from "@punchpress/engine";
import {
  getVectorCornerPointByIdentity,
  type VectorCornerDragSession,
  type VectorPathPoint,
} from "./vector-corner-drag-session";

const MAXED_VECTOR_CORNER_RADIUS_EPSILON = 0.5;

const getUniqueCornerHandlePoints = (points, contours) => {
  const seenCornerKeys = new Set<string>();

  return points.flatMap((point) => {
    const control = getVectorPointCornerControl(contours, point);

    if (!(control && !seenCornerKeys.has(control.key))) {
      return [];
    }

    seenCornerKeys.add(control.key);
    return [point];
  });
};

const getAllCornerHandlePoints = (contours) => {
  if (!contours?.length) {
    return [];
  }

  return getUniqueCornerHandlePoints(
    contours.flatMap((contour, contourIndex) => {
      return contour.segments.map((_, segmentIndex) => {
        return {
          contourIndex,
          segmentIndex,
        };
      });
    }),
    contours
  );
};

const getSelectedCornerHandlePoints = (contours, selectedPoints) => {
  if (!(contours?.length > 0 && selectedPoints?.length > 0)) {
    return [];
  }

  return getUniqueCornerHandlePoints(selectedPoints, contours);
};

const getCurveSegmentFromPoint = (contours, point) => {
  const control = getVectorPointCornerControl(contours, point);

  if (control?.kind !== "detected") {
    return null;
  }

  return {
    contourIndex: control.contourIndex,
    endIndex: control.endIndex,
    startIndex: control.startIndex,
  };
};

export const getVisibleVectorCornerHandles = (
  contours,
  selectedPoints: VectorPathPoint[] = [],
  activeDragSession: VectorCornerDragSession | null = null
) => {
  if (activeDragSession) {
    const activePoint = getVectorCornerPointByIdentity(
      contours,
      activeDragSession.identity
    );

    return {
      dragScope: activePoint ? "active" : null,
      points: activePoint ? [activePoint] : [],
    };
  }

  const selectedHandlePoints = getSelectedCornerHandlePoints(
    contours,
    selectedPoints
  );

  if (selectedPoints.length > 0) {
    return {
      dragScope: selectedHandlePoints.length > 0 ? "selected" : null,
      points: selectedHandlePoints,
    };
  }

  const allHandlePoints = getAllCornerHandlePoints(contours);

  return {
    dragScope: allHandlePoints.length > 0 ? "all" : null,
    points: allHandlePoints,
  };
};

export const getVisibleVectorCornerHandlePoints = (
  contours,
  selectedPoints: VectorPathPoint[] = [],
  activeDragSession: VectorCornerDragSession | null = null
) => {
  return getVisibleVectorCornerHandles(
    contours,
    selectedPoints,
    activeDragSession
  ).points;
};

export const shouldAdjustSelectedCornerPoints = (dragScope, selectedPoints) => {
  return (
    dragScope === "all" ||
    (dragScope === "selected" && selectedPoints.length > 0)
  );
};

export const getHoveredVectorCornerCurveSegment = (contours, hoveredPoint) => {
  if (!(contours?.length > 0 && hoveredPoint)) {
    return null;
  }

  return getCurveSegmentFromPoint(contours, hoveredPoint);
};

export const getMaxedVectorCornerCurveSegments = (
  contours,
  selectedPoints: VectorPathPoint[] = [],
  stableMaxRadius: number | null = null,
  activeDragSession: VectorCornerDragSession | null = null
) => {
  if (!contours?.length) {
    return [];
  }

  const visibleHandles = getVisibleVectorCornerHandles(
    contours,
    selectedPoints
  );
  const maxRadius =
    typeof stableMaxRadius === "number"
      ? stableMaxRadius
      : getStableVectorCornerRadiusMax(contours, selectedPoints);
  const maxedSegments = visibleHandles.points.flatMap((point) => {
    const control = getVectorPointCornerControl(contours, point);

    if (
      control?.kind !== "detected" ||
      maxRadius - control.currentRadius > MAXED_VECTOR_CORNER_RADIUS_EPSILON
    ) {
      return [];
    }

    return [
      {
        contourIndex: control.contourIndex,
        endIndex: control.endIndex,
        startIndex: control.startIndex,
      },
    ];
  });

  if (!activeDragSession?.isAtMax) {
    return maxedSegments;
  }

  const activePoint = getVectorCornerPointByIdentity(
    contours,
    activeDragSession.identity
  );
  const activeSegment =
    activePoint && getCurveSegmentFromPoint(contours, activePoint);

  if (!activeSegment) {
    return maxedSegments;
  }

  const hasActiveSegment = maxedSegments.some((segment) => {
    return (
      segment.contourIndex === activeSegment.contourIndex &&
      segment.startIndex === activeSegment.startIndex &&
      segment.endIndex === activeSegment.endIndex
    );
  });

  return hasActiveSegment ? maxedSegments : [...maxedSegments, activeSegment];
};
