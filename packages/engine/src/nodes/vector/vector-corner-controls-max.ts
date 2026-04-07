import { applyVectorCornerRadiusToControls } from "./vector-corner-controls-mutation";
import {
  getEligibleVectorCornerPoints,
  getRoundableVectorPoints,
  getVectorPointCornerDescriptor,
  getVectorSegmentCornerControl,
} from "./vector-corner-controls-query";
import {
  getCornerCutDistance,
  getPointDistance,
  getVectorCornerKey,
} from "./vector-corner-controls-shared";

const getContourLogicalCornerVertices = (
  contours,
  contourIndex,
  selectedKeys
) => {
  const contour = contours?.[contourIndex];

  if (!contour) {
    return [];
  }

  const detectedByStartIndex = new Map();
  const detectedEndIndices = new Set<number>();

  contour.segments.forEach((_, segmentIndex) => {
    const control = getVectorPointCornerDescriptor(contours, {
      contourIndex,
      segmentIndex,
    });

    if (control?.kind !== "detected" || control.startIndex !== segmentIndex) {
      return;
    }

    detectedByStartIndex.set(segmentIndex, control);
    detectedEndIndices.add(control.endIndex);
  });

  return contour.segments.flatMap((segment, segmentIndex) => {
    const detectedControl = detectedByStartIndex.get(segmentIndex);

    if (detectedControl) {
      return [
        {
          anchor: detectedControl.anchor,
          control: detectedControl,
          currentCutDistance: getCornerCutDistance(detectedControl),
          selected: selectedKeys.has(detectedControl.key),
        },
      ];
    }

    if (detectedEndIndices.has(segmentIndex)) {
      return [];
    }

    const sharpControl = getVectorSegmentCornerControl(contour, segmentIndex);
    const control = sharpControl
      ? {
          ...sharpControl,
          contourIndex,
          key: getVectorCornerKey(contourIndex, segmentIndex),
        }
      : null;

    return [
      {
        anchor: segment.point,
        control,
        currentCutDistance: getCornerCutDistance(control),
        selected: control ? selectedKeys.has(control.key) : false,
      },
    ];
  });
};

const getSelectedVectorCornerKeys = (contours, points = null) => {
  return new Set(
    getEligibleVectorCornerPoints(contours, points)
      .map((point) => getVectorPointCornerDescriptor(contours, point)?.key)
      .filter(Boolean)
  );
};

const getLogicalCornerEdgeMax = (startVertex, endVertex) => {
  if (!(startVertex && endVertex)) {
    return null;
  }

  const selectedVertexCount =
    Number(startVertex.selected) + Number(endVertex.selected);

  if (selectedVertexCount === 0) {
    return null;
  }

  const edgeLength = getPointDistance(startVertex.anchor, endVertex.anchor);
  const fixedCutDistance =
    (startVertex.selected ? 0 : startVertex.currentCutDistance) +
    (endVertex.selected ? 0 : endVertex.currentCutDistance);
  const variableCutScale =
    (startVertex.selected && startVertex.control
      ? 1 / Math.tan(startVertex.control.cornerAngle / 2)
      : 0) +
    (endVertex.selected && endVertex.control
      ? 1 / Math.tan(endVertex.control.cornerAngle / 2)
      : 0);

  if (variableCutScale <= 0) {
    return null;
  }

  return Math.max(0, (edgeLength - fixedCutDistance) / variableCutScale);
};

const getSharedVectorCornerRadiusMaxForContour = (
  logicalVertices,
  isClosed
) => {
  if (logicalVertices.length < 2) {
    return Number.POSITIVE_INFINITY;
  }

  const edgeCount = isClosed
    ? logicalVertices.length
    : logicalVertices.length - 1;
  let contourMax = Number.POSITIVE_INFINITY;

  for (let edgeIndex = 0; edgeIndex < edgeCount; edgeIndex += 1) {
    const edgeMax = getLogicalCornerEdgeMax(
      logicalVertices[edgeIndex],
      logicalVertices[(edgeIndex + 1) % logicalVertices.length]
    );

    if (edgeMax === null) {
      continue;
    }

    contourMax = Math.min(contourMax, edgeMax);
  }

  return contourMax;
};

const getSharedVectorCornerRadiusMax = (contours, points = null) => {
  if (!contours?.length) {
    return 0;
  }

  const selectedKeys = getSelectedVectorCornerKeys(contours, points);

  if (selectedKeys.size === 0) {
    return 0;
  }

  let sharedMax = Number.POSITIVE_INFINITY;

  contours.forEach((contour, contourIndex) => {
    sharedMax = Math.min(
      sharedMax,
      getSharedVectorCornerRadiusMaxForContour(
        getContourLogicalCornerVertices(contours, contourIndex, selectedKeys),
        contour.closed
      )
    );
  });

  return Number.isFinite(sharedMax) ? sharedMax : 0;
};

const getRoundableVectorCornerCount = (contours) => {
  return getRoundableVectorPoints(contours).length;
};

const getStableAppliedVectorCornerRadius = (
  contours,
  controls,
  requestedCornerRadius
) => {
  const nextCornerRadius = Math.max(0, requestedCornerRadius || 0);

  if (nextCornerRadius <= 0) {
    return 0;
  }

  const initialRoundableCornerCount = getRoundableVectorCornerCount(contours);
  const maxRequestedCornerRadius = Math.min(
    nextCornerRadius,
    controls.reduce((currentMax, control) => {
      return Math.max(currentMax, control.maxRadius);
    }, 0)
  );
  const hasStableCornerCount = (candidateContours) => {
    return (
      candidateContours &&
      getRoundableVectorCornerCount(candidateContours) ===
        initialRoundableCornerCount
    );
  };

  if (maxRequestedCornerRadius <= 0) {
    return 0;
  }

  const maxRequestedContours = applyVectorCornerRadiusToControls(
    contours,
    controls,
    maxRequestedCornerRadius
  );

  if (hasStableCornerCount(maxRequestedContours)) {
    return maxRequestedCornerRadius;
  }

  let low = 0;
  let high = maxRequestedCornerRadius;
  let best = 0;

  for (let iteration = 0; iteration < 24; iteration += 1) {
    const mid = (low + high) / 2;
    const midContours = applyVectorCornerRadiusToControls(
      contours,
      controls,
      mid
    );

    if (hasStableCornerCount(midContours)) {
      best = mid;
      low = mid;
      continue;
    }

    high = mid;
  }

  return best;
};

export const getStableVectorCornerRadiusMax = (contours, points = null) => {
  const eligibleControls = getEligibleVectorCornerPoints(contours, points)
    .map((point) => getVectorPointCornerDescriptor(contours, point))
    .filter(Boolean);

  if (!(contours && eligibleControls.length > 0)) {
    return 0;
  }

  return getStableAppliedVectorCornerRadius(
    contours,
    eligibleControls,
    getSharedVectorCornerRadiusMax(contours, points)
  );
};

export const setAllVectorPointCornerRadii = (
  contours,
  cornerRadius,
  points = null
) => {
  const nextCornerRadius = Math.max(0, cornerRadius || 0);
  const eligibleControls = getEligibleVectorCornerPoints(contours, points)
    .map((point) => getVectorPointCornerDescriptor(contours, point))
    .filter(Boolean);

  if (!(contours && eligibleControls.length > 0)) {
    return null;
  }

  const appliedCornerRadius =
    nextCornerRadius <= 0
      ? 0
      : getStableAppliedVectorCornerRadius(
          contours,
          eligibleControls,
          Math.min(
            nextCornerRadius,
            getSharedVectorCornerRadiusMax(contours, points)
          )
        );

  return applyVectorCornerRadiusToControls(
    contours,
    eligibleControls,
    appliedCornerRadius
  );
};
