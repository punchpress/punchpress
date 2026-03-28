import type {
  VectorContourDocument,
  VectorSegmentDocument,
} from "@punchpress/punch-schema";

const cloneHandle = (handle) => {
  return {
    x: handle.x,
    y: handle.y,
  };
};

const cloneSegment = (segment: VectorSegmentDocument): VectorSegmentDocument => {
  return {
    ...segment,
    handleIn: cloneHandle(segment.handleIn),
    handleOut: cloneHandle(segment.handleOut),
    point: cloneHandle(segment.point),
  };
};

export const insertVectorPoint = (
  contours: VectorContourDocument[],
  target: {
    contourIndex: number;
    segments: VectorSegmentDocument[];
  }
) => {
  return contours.map((contour, contourIndex) => {
    if (contourIndex !== target.contourIndex) {
      return contour;
    }

    return {
      ...contour,
      segments: target.segments.map(cloneSegment),
    };
  });
};
