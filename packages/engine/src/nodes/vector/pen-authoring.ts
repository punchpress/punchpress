import { getUniformVectorCornerRadius } from "./vector-corner-controls";

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

export const createPenContour = (point) => {
  return {
    closed: false,
    segments: [
      {
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point: {
          x: point.x,
          y: point.y,
        },
        pointType: "corner",
      },
    ],
  };
};

export const appendPenContourSegment = (
  contours,
  { contourIndex, handleIn, handleOut, point, pointType }
) => {
  return contours.map((contour, index) => {
    if (index !== contourIndex) {
      return contour;
    }

    return {
      ...contour,
      segments: [
        ...contour.segments.map(cloneSegment),
        {
          handleIn: cloneHandle(handleIn || { x: 0, y: 0 }),
          handleOut: cloneHandle(handleOut || { x: 0, y: 0 }),
          point: {
            x: point.x,
            y: point.y,
          },
          pointType: pointType || "corner",
        },
      ],
    };
  });
};

export const replacePenContourSegment = (
  contours,
  { contourIndex, handleIn, handleOut, point, pointType, segmentIndex }
) => {
  return contours.map((contour, index) => {
    if (index !== contourIndex) {
      return contour;
    }

    return {
      ...contour,
      segments: contour.segments.map((segment, currentSegmentIndex) => {
        if (currentSegmentIndex !== segmentIndex) {
          return cloneSegment(segment);
        }

        return {
          ...cloneSegment(segment),
          ...(point
            ? {
                point: cloneHandle(point),
              }
            : null),
          ...(handleIn
            ? {
                handleIn: cloneHandle(handleIn),
              }
            : null),
          ...(handleOut
            ? {
                handleOut: cloneHandle(handleOut),
              }
            : null),
          ...(pointType
            ? {
                pointType,
              }
            : null),
        };
      }),
    };
  });
};

export const closePenContour = (contours, contourIndex) => {
  const inheritedCornerRadius = getUniformVectorCornerRadius(contours);

  return contours.map((contour, index) => {
    if (index !== contourIndex) {
      return contour;
    }

    return {
      ...contour,
      closed: true,
      segments: contour.segments.map((segment, segmentIndex) => {
        const nextSegment = cloneSegment(segment);

        if (
          typeof inheritedCornerRadius === "number" &&
          (segmentIndex === 0 || segmentIndex === contour.segments.length - 1) &&
          nextSegment.pointType === "corner"
        ) {
          return {
            ...nextSegment,
            cornerRadius: inheritedCornerRadius,
          };
        }

        return nextSegment;
      }),
    };
  });
};

export const reversePenContour = (contours, contourIndex) => {
  return contours.map((contour, index) => {
    if (index !== contourIndex) {
      return contour;
    }

    return {
      ...contour,
      segments: [...contour.segments].reverse().map((segment) => {
        return {
          ...cloneSegment(segment),
          handleIn: cloneHandle(segment.handleOut),
          handleOut: cloneHandle(segment.handleIn),
        };
      }),
    };
  });
};
