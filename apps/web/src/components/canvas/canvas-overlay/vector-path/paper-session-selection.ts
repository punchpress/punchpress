import {
  includesPathPoint,
  isSamePathPoint,
  normalizePathPointSelection,
  offsetEditablePathPoints as offsetEngineEditablePathPoints,
  toPathPointKey,
} from "@punchpress/engine";
import { projectPoint } from "./paper-session-render";

export const isSamePointSelection = isSamePathPoint;
export const getPointSelectionKey = toPathPointKey;
export const isPointSelectionIncluded = includesPathPoint;
export const offsetEditablePathPoints = offsetEngineEditablePathPoints;

export const normalizePointSelections = (points, primaryPoint = null) => {
  const normalizedSelection = normalizePathPointSelection(points, primaryPoint);

  return {
    points: normalizedSelection.pathEditingPoints,
    primaryPoint: normalizedSelection.pathEditingPoint,
  };
};

export const getAnchorSelectionsInRectangle = (contours, matrix, from, to) => {
  if (!matrix) {
    return [];
  }

  const minX = Math.min(from.x, to.x);
  const maxX = Math.max(from.x, to.x);
  const minY = Math.min(from.y, to.y);
  const maxY = Math.max(from.y, to.y);

  return contours.flatMap((contour, contourIndex) => {
    return contour.segments.flatMap((segment, segmentIndex) => {
      const point = projectPoint(matrix, segment.point);

      if (
        point.x < minX ||
        point.x > maxX ||
        point.y < minY ||
        point.y > maxY
      ) {
        return [];
      }

      return [
        {
          contourIndex,
          segmentIndex,
        },
      ];
    });
  });
};
