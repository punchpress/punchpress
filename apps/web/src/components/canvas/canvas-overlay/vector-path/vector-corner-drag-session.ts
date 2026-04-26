import { getVectorPointCornerControl } from "@punchpress/engine";
import type { VectorCornerWidgetGeometry } from "./corner-widget-geometry";

const ACTIVE_VECTOR_CORNER_ANCHOR_EPSILON = 0.5;

export interface VectorPathPoint {
  contourIndex: number;
  segmentIndex: number;
}

export interface VectorCornerDragIdentity {
  anchor: {
    x: number;
    y: number;
  };
  contourIndex: number;
  key: string;
}

export interface VectorCornerDragSession {
  adjustedPoints: VectorPathPoint[];
  displayGeometry: VectorCornerWidgetGeometry;
  displayRadius: number;
  identity: VectorCornerDragIdentity;
  isAtMax: boolean;
  maxRadius: number;
}

const isSameCornerAnchor = (from, to) => {
  return (
    Math.hypot((to?.x || 0) - (from?.x || 0), (to?.y || 0) - (from?.y || 0)) <=
    ACTIVE_VECTOR_CORNER_ANCHOR_EPSILON
  );
};

export const getVectorCornerDragIdentity = (contours, point) => {
  const control = getVectorPointCornerControl(contours, point);

  if (!control) {
    return null;
  }

  return {
    anchor: control.anchor,
    contourIndex: control.contourIndex,
    key: control.key,
  };
};

export const createVectorCornerDragSession = ({
  adjustedPoints = [],
  contours,
  displayGeometry,
  displayRadius,
  isAtMax = false,
  maxRadius,
  point,
}) => {
  const identity = getVectorCornerDragIdentity(contours, point);

  if (!(identity && displayGeometry)) {
    return null;
  }

  return {
    adjustedPoints,
    displayGeometry,
    displayRadius,
    identity,
    isAtMax,
    maxRadius,
  } satisfies VectorCornerDragSession;
};

export const getVectorCornerPointByIdentity = (contours, identity = null) => {
  if (!(contours?.length > 0 && identity)) {
    return null;
  }

  for (const [contourIndex, contour] of contours.entries()) {
    for (const [segmentIndex] of contour.segments.entries()) {
      const point = {
        contourIndex,
        segmentIndex,
      };
      const control = getVectorPointCornerControl(contours, point);

      if (
        control?.contourIndex === identity.contourIndex &&
        isSameCornerAnchor(control.anchor, identity.anchor)
      ) {
        return point;
      }
    }
  }

  for (const [contourIndex, contour] of contours.entries()) {
    for (const [segmentIndex] of contour.segments.entries()) {
      const point = {
        contourIndex,
        segmentIndex,
      };
      const control = getVectorPointCornerControl(contours, point);

      if (control?.key === identity.key) {
        return point;
      }
    }
  }

  return null;
};
