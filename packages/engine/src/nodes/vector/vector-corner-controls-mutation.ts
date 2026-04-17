import { clampCornerRadius } from "../../primitives/corner-radius";
import { getVectorPointCornerDescriptor } from "./vector-corner-controls-query";
import {
  clampNumber,
  cloneHandle,
  cloneSegment,
  getCornerCutDistanceForRadius,
  getRelativeHandle,
  getRoundCornerHandleLength,
  getUnitVector,
} from "./vector-corner-controls-shared";
import {
  getNextVectorSegmentIndex,
  getPreviousVectorSegmentIndex,
} from "./vector-curve";

const getSharpVectorRoundCornerGeometry = (descriptor, cornerRadius) => {
  if (descriptor?.kind !== "sharp") {
    return null;
  }

  const requestedCutDistance =
    cornerRadius / Math.tan(descriptor.cornerAngle / 2);
  const maxCutDistance =
    Math.min(descriptor.previousCurveLength, descriptor.nextCurveLength) / 2;
  const cutDistance = clampNumber(requestedCutDistance, 0, maxCutDistance);

  if (cutDistance <= 0.0001) {
    return null;
  }

  const appliedRadius = cutDistance * Math.tan(descriptor.cornerAngle / 2);
  const turnAngle = Math.PI - descriptor.cornerAngle;
  const handleLength =
    (4 / 3) * Math.tan(turnAngle / 4) * Math.max(appliedRadius, 0);
  const start = {
    x: descriptor.anchor.x + descriptor.previousDirection.x * cutDistance,
    y: descriptor.anchor.y + descriptor.previousDirection.y * cutDistance,
  };
  const end = {
    x: descriptor.anchor.x + descriptor.nextDirection.x * cutDistance,
    y: descriptor.anchor.y + descriptor.nextDirection.y * cutDistance,
  };

  return {
    appliedRadius,
    controlIn: {
      x: start.x - descriptor.previousDirection.x * handleLength,
      y: start.y - descriptor.previousDirection.y * handleLength,
    },
    controlOut: {
      x: end.x - descriptor.nextDirection.x * handleLength,
      y: end.y - descriptor.nextDirection.y * handleLength,
    },
    end,
    start,
  };
};

const setSharpVectorCornerRadius = (contours, descriptor, cornerRadius) => {
  const nextCornerRadius = clampCornerRadius(cornerRadius);
  const contour = contours?.[descriptor?.contourIndex];

  if (!(contour && descriptor?.kind === "sharp")) {
    return null;
  }

  if (nextCornerRadius <= 0) {
    return contours;
  }

  const geometry = getSharpVectorRoundCornerGeometry(
    descriptor,
    nextCornerRadius
  );
  const previousIndex = getPreviousVectorSegmentIndex(
    contour,
    descriptor.segmentIndex
  );
  const nextIndex = getNextVectorSegmentIndex(contour, descriptor.segmentIndex);

  if (!(geometry && previousIndex >= 0 && nextIndex >= 0)) {
    return null;
  }

  const nextSegments = contour.segments.map(cloneSegment);
  const previousSegment = nextSegments[previousIndex];
  const nextSegment = nextSegments[nextIndex];

  if (!(previousSegment && nextSegment)) {
    return null;
  }

  nextSegments[previousIndex] = {
    ...previousSegment,
    handleOut: { x: 0, y: 0 },
  };
  nextSegments[nextIndex] = {
    ...nextSegment,
    handleIn: { x: 0, y: 0 },
  };

  const startSegment = {
    handleIn: { x: 0, y: 0 },
    handleOut: getRelativeHandle(geometry.start, geometry.controlIn),
    point: cloneHandle(geometry.start),
    pointType: "corner",
  };
  const endSegment = {
    handleIn: getRelativeHandle(geometry.end, geometry.controlOut),
    handleOut: { x: 0, y: 0 },
    point: cloneHandle(geometry.end),
    pointType: "corner",
  };

  nextSegments.splice(descriptor.segmentIndex, 1, startSegment, endSegment);

  return contours.map((currentContour, contourIndex) => {
    if (contourIndex !== descriptor.contourIndex) {
      return currentContour;
    }

    return {
      ...currentContour,
      segments: nextSegments,
    };
  });
};

const setDetectedVectorRoundCornerRadius = (
  contours,
  descriptor,
  cornerRadius,
  options = {}
) => {
  const nextCornerRadius = clampCornerRadius(cornerRadius);
  const contour = contours?.[descriptor?.contourIndex];

  if (!(contour && descriptor?.kind === "detected")) {
    return null;
  }

  const requestedCutDistance = getCornerCutDistanceForRadius(
    descriptor,
    nextCornerRadius
  );
  const maxCutDistance =
    descriptor.maxRadius / Math.tan(descriptor.cornerAngle / 2);
  const nextCutDistance =
    options.clampToDescriptorMax === false
      ? Math.max(0, requestedCutDistance)
      : clampNumber(requestedCutDistance, 0, maxCutDistance);
  const startTowardCorner = getUnitVector({
    x:
      descriptor.virtualCorner.x -
      contour.segments[descriptor.startIndex].point.x,
    y:
      descriptor.virtualCorner.y -
      contour.segments[descriptor.startIndex].point.y,
  });
  const endTowardCorner = getUnitVector({
    x:
      descriptor.virtualCorner.x -
      contour.segments[descriptor.endIndex].point.x,
    y:
      descriptor.virtualCorner.y -
      contour.segments[descriptor.endIndex].point.y,
  });

  if (!(startTowardCorner && endTowardCorner)) {
    return null;
  }

  const nextSegments = contour.segments.map(cloneSegment);

  if (nextCornerRadius <= 0) {
    const keepStart = descriptor.selectedSegmentIndex !== descriptor.endIndex;
    const keepIndex = keepStart ? descriptor.startIndex : descriptor.endIndex;
    const removeIndex = keepStart ? descriptor.endIndex : descriptor.startIndex;

    nextSegments[keepIndex] = {
      ...nextSegments[keepIndex],
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: cloneHandle(descriptor.virtualCorner),
      pointType: "corner",
    };
    nextSegments.splice(removeIndex, 1);

    return contours.map((currentContour, contourIndex) => {
      if (contourIndex !== descriptor.contourIndex) {
        return currentContour;
      }

      return {
        ...currentContour,
        segments: nextSegments,
      };
    });
  }

  const handleLength = getRoundCornerHandleLength(
    descriptor.cornerAngle,
    nextCornerRadius
  );
  const nextStartPoint = {
    x: descriptor.virtualCorner.x - startTowardCorner.x * nextCutDistance,
    y: descriptor.virtualCorner.y - startTowardCorner.y * nextCutDistance,
  };
  const nextEndPoint = {
    x: descriptor.virtualCorner.x - endTowardCorner.x * nextCutDistance,
    y: descriptor.virtualCorner.y - endTowardCorner.y * nextCutDistance,
  };

  nextSegments[descriptor.startIndex] = {
    ...nextSegments[descriptor.startIndex],
    handleIn: { x: 0, y: 0 },
    handleOut: {
      x: startTowardCorner.x * handleLength,
      y: startTowardCorner.y * handleLength,
    },
    point: nextStartPoint,
    pointType: "corner",
  };
  nextSegments[descriptor.endIndex] = {
    ...nextSegments[descriptor.endIndex],
    handleIn: {
      x: endTowardCorner.x * handleLength,
      y: endTowardCorner.y * handleLength,
    },
    handleOut: { x: 0, y: 0 },
    point: nextEndPoint,
    pointType: "corner",
  };

  return contours.map((currentContour, contourIndex) => {
    if (contourIndex !== descriptor.contourIndex) {
      return currentContour;
    }

    return {
      ...currentContour,
      segments: nextSegments,
    };
  });
};

export const setVectorPointCornerRadius = (contours, point, cornerRadius) => {
  const nextCornerRadius = clampCornerRadius(cornerRadius);
  const descriptor = getVectorPointCornerDescriptor(contours, point);

  if (!(contours && point && descriptor)) {
    return null;
  }

  if (descriptor.kind === "detected") {
    return setDetectedVectorRoundCornerRadius(
      contours,
      descriptor,
      nextCornerRadius
    );
  }

  return setSharpVectorCornerRadius(contours, descriptor, nextCornerRadius);
};

const sortVectorCornerControls = (controls) => {
  return [...controls].sort((a, b) => {
    if (a.contourIndex !== b.contourIndex) {
      return b.contourIndex - a.contourIndex;
    }

    const aIndex = a.kind === "detected" ? a.startIndex : a.segmentIndex;
    const bIndex = b.kind === "detected" ? b.startIndex : b.segmentIndex;

    return bIndex - aIndex;
  });
};

export const applyVectorCornerRadiusToControls = (
  contours,
  controls,
  cornerRadius
) => {
  let nextContours = contours;
  const normalizedCornerRadius = clampCornerRadius(cornerRadius);

  for (const control of sortVectorCornerControls(controls)) {
    const updatedContours =
      control.kind === "detected"
        ? setDetectedVectorRoundCornerRadius(
            nextContours,
            control,
            normalizedCornerRadius,
            {
              clampToDescriptorMax: false,
            }
          )
        : setSharpVectorCornerRadius(
            nextContours,
            control,
            normalizedCornerRadius
          );

    if (updatedContours) {
      nextContours = updatedContours;
    }
  }

  return nextContours;
};
