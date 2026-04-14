import type {
  VectorContourDocument,
  VectorHandleDocument,
} from "@punchpress/punch-schema";

interface PathPoint {
  contourIndex: number;
  segmentIndex: number;
}

const JOIN_POINT_EPSILON = 0.01;

const getZeroHandle = (): VectorHandleDocument => {
  return { x: 0, y: 0 };
};

const cloneHandle = (handle: VectorHandleDocument): VectorHandleDocument => {
  return {
    x: handle.x,
    y: handle.y,
  };
};

const cloneSegment = (segment: VectorContourDocument["segments"][number]) => {
  return {
    ...segment,
    handleIn: cloneHandle(segment.handleIn),
    handleOut: cloneHandle(segment.handleOut),
    point: cloneHandle(segment.point),
  };
};

const cloneContour = (
  contour: VectorContourDocument
): VectorContourDocument => {
  return {
    ...contour,
    segments: contour.segments.map(cloneSegment),
  };
};

const isSamePoint = (left: PathPoint, right: PathPoint) => {
  return (
    left.contourIndex === right.contourIndex &&
    left.segmentIndex === right.segmentIndex
  );
};

const arePointsCoincident = (
  left: VectorHandleDocument,
  right: VectorHandleDocument
) => {
  return Math.hypot(left.x - right.x, left.y - right.y) <= JOIN_POINT_EPSILON;
};

const isEndpoint = (contour: VectorContourDocument, segmentIndex: number) => {
  if (contour.closed) {
    return false;
  }

  return segmentIndex === 0 || segmentIndex === contour.segments.length - 1;
};

const reverseContour = (
  contour: VectorContourDocument
): VectorContourDocument => {
  return {
    ...cloneContour(contour),
    segments: [...contour.segments].reverse().map((segment) => {
      return {
        ...cloneSegment(segment),
        handleIn: cloneHandle(segment.handleOut),
        handleOut: cloneHandle(segment.handleIn),
      };
    }),
  };
};

const getSplitResult = (
  contours: VectorContourDocument[],
  point: PathPoint
) => {
  const contour = contours[point.contourIndex];
  const segment = contour?.segments[point.segmentIndex];

  if (!(contour && segment)) {
    return null;
  }

  if (contour.closed) {
    const startSegment = {
      ...cloneSegment(segment),
      handleIn: getZeroHandle(),
    };
    const endSegment = {
      ...cloneSegment(segment),
      handleOut: getZeroHandle(),
    };
    const middleSegments = [
      ...contour.segments.slice(point.segmentIndex + 1),
      ...contour.segments.slice(0, point.segmentIndex),
    ].map(cloneSegment);
    const nextContour = {
      ...cloneContour(contour),
      closed: false,
      segments: [startSegment, ...middleSegments, endSegment],
    };

    return {
      contours: contours.map((currentContour, contourIndex) => {
        return contourIndex === point.contourIndex
          ? nextContour
          : currentContour;
      }),
      primaryPoint: {
        contourIndex: point.contourIndex,
        segmentIndex: 0,
      },
      selectedPoints: [
        {
          contourIndex: point.contourIndex,
          segmentIndex: 0,
        },
      ],
    };
  }

  if (
    point.segmentIndex <= 0 ||
    point.segmentIndex >= contour.segments.length - 1
  ) {
    return null;
  }

  const leftSegments = contour.segments
    .slice(0, point.segmentIndex + 1)
    .map(cloneSegment);
  const rightSegments = contour.segments
    .slice(point.segmentIndex)
    .map(cloneSegment);

  leftSegments[leftSegments.length - 1] = {
    ...leftSegments.at(-1),
    handleOut: getZeroHandle(),
  };
  rightSegments[0] = {
    ...rightSegments[0],
    handleIn: getZeroHandle(),
  };

  return {
    contours: [
      ...contours.slice(0, point.contourIndex),
      {
        ...cloneContour(contour),
        closed: false,
        segments: leftSegments,
      },
      {
        ...cloneContour(contour),
        closed: false,
        segments: rightSegments,
      },
      ...contours.slice(point.contourIndex + 1),
    ],
    primaryPoint: {
      contourIndex: point.contourIndex + 1,
      segmentIndex: 0,
    },
    selectedPoints: [
      {
        contourIndex: point.contourIndex + 1,
        segmentIndex: 0,
      },
    ],
  };
};

const getSameContourJoinResult = (
  contours: VectorContourDocument[],
  contourIndex: number,
  firstPoint: PathPoint,
  secondPoint: PathPoint,
  contour: VectorContourDocument
) => {
  if (
    contour.closed ||
    contour.segments.length < 2 ||
    !(
      (firstPoint.segmentIndex === 0 &&
        secondPoint.segmentIndex === contour.segments.length - 1) ||
      (secondPoint.segmentIndex === 0 &&
        firstPoint.segmentIndex === contour.segments.length - 1)
    )
  ) {
    return null;
  }

  const nextSegments = contour.segments.map(cloneSegment);
  const firstSegment = nextSegments[0];
  const lastSegment = nextSegments.at(-1);

  if (!(firstSegment && lastSegment)) {
    return null;
  }

  nextSegments[0] = {
    ...firstSegment,
    handleIn: cloneHandle(lastSegment.handleIn),
    pointType: "corner",
  };
  nextSegments.pop();

  return {
    contours: contours.map((currentContour, currentContourIndex) => {
      if (currentContourIndex !== contourIndex) {
        return currentContour;
      }

      return {
        ...cloneContour(contour),
        closed: true,
        segments: nextSegments,
      };
    }),
    primaryPoint: {
      contourIndex,
      segmentIndex: 0,
    },
    selectedPoints: [
      {
        contourIndex,
        segmentIndex: 0,
      },
    ],
  };
};

const getJoinedSegments = (
  orientedFirstContour: VectorContourDocument,
  orientedSecondContour: VectorContourDocument
) => {
  const firstJoinSegment = orientedFirstContour.segments.at(-1);
  const secondJoinSegment = orientedSecondContour.segments[0];

  if (
    !(
      firstJoinSegment &&
      secondJoinSegment &&
      arePointsCoincident(firstJoinSegment.point, secondJoinSegment.point)
    )
  ) {
    return [
      ...orientedFirstContour.segments,
      ...orientedSecondContour.segments,
    ];
  }

  return [
    ...orientedFirstContour.segments.slice(0, -1),
    {
      ...cloneSegment(firstJoinSegment),
      handleOut: cloneHandle(secondJoinSegment.handleOut),
      pointType:
        Math.hypot(firstJoinSegment.handleIn.x, firstJoinSegment.handleIn.y) >
          JOIN_POINT_EPSILON ||
        Math.hypot(
          secondJoinSegment.handleOut.x,
          secondJoinSegment.handleOut.y
        ) > JOIN_POINT_EPSILON
          ? "smooth"
          : "corner",
    },
    ...orientedSecondContour.segments.slice(1),
  ];
};

const getJoinResult = (
  contours: VectorContourDocument[],
  points: PathPoint[]
) => {
  if (points.length !== 2 || isSamePoint(points[0], points[1])) {
    return null;
  }

  const [firstPoint, secondPoint] = points;
  const firstContour = contours[firstPoint.contourIndex];
  const secondContour = contours[secondPoint.contourIndex];

  if (!(firstContour && secondContour)) {
    return null;
  }

  if (
    !(
      isEndpoint(firstContour, firstPoint.segmentIndex) &&
      isEndpoint(secondContour, secondPoint.segmentIndex)
    )
  ) {
    return null;
  }

  if (firstPoint.contourIndex === secondPoint.contourIndex) {
    return getSameContourJoinResult(
      contours,
      firstPoint.contourIndex,
      firstPoint,
      secondPoint,
      firstContour
    );
  }

  const orientedFirstContour =
    firstPoint.segmentIndex === 0
      ? reverseContour(firstContour)
      : cloneContour(firstContour);
  const orientedSecondContour =
    secondPoint.segmentIndex === 0
      ? cloneContour(secondContour)
      : reverseContour(secondContour);
  const joinedContour = {
    ...cloneContour(firstContour),
    closed: false,
    segments: getJoinedSegments(orientedFirstContour, orientedSecondContour),
  };
  const insertIndex = Math.min(
    firstPoint.contourIndex,
    secondPoint.contourIndex
  );
  const nextContours = contours.filter((_, contourIndex) => {
    return (
      contourIndex !== firstPoint.contourIndex &&
      contourIndex !== secondPoint.contourIndex
    );
  });

  nextContours.splice(insertIndex, 0, joinedContour);

  return {
    contours: nextContours,
    primaryPoint: {
      contourIndex: insertIndex,
      segmentIndex: orientedFirstContour.segments.length - 1,
    },
    selectedPoints: [
      {
        contourIndex: insertIndex,
        segmentIndex: orientedFirstContour.segments.length - 1,
      },
    ],
  };
};

export const canSplitVectorPath = (node, point: PathPoint | null) => {
  if (!(node?.type === "vector" && point)) {
    return false;
  }

  return Boolean(getSplitResult(node.contours, point));
};

export const splitVectorPath = (editor, nodeId, point: PathPoint | null) => {
  const node = editor.getNode(nodeId);

  if (!(node?.type === "vector" && point)) {
    return false;
  }

  const result = getSplitResult(node.contours, point);

  if (!result) {
    return false;
  }

  editor.run(() => {
    editor.getState().updateNodeById(nodeId, (currentNode) => {
      if (currentNode.type !== "vector") {
        return currentNode;
      }

      return {
        ...currentNode,
        contours: result.contours,
      };
    });
    editor
      .getState()
      .setPathEditingPoints(result.selectedPoints, result.primaryPoint);
  });

  return true;
};

export const canJoinVectorPathEndpoints = (node, points: PathPoint[]) => {
  if (!(node?.type === "vector")) {
    return false;
  }

  return Boolean(getJoinResult(node.contours, points));
};

export const joinVectorPathEndpoints = (
  editor,
  nodeId,
  points: PathPoint[]
) => {
  const node = editor.getNode(nodeId);

  if (!(node?.type === "vector")) {
    return false;
  }

  const result = getJoinResult(node.contours, points);

  if (!result) {
    return false;
  }

  editor.run(() => {
    editor.getState().updateNodeById(nodeId, (currentNode) => {
      if (currentNode.type !== "vector") {
        return currentNode;
      }

      return {
        ...currentNode,
        contours: result.contours,
      };
    });
    editor
      .getState()
      .setPathEditingPoints(result.selectedPoints, result.primaryPoint);
  });

  return true;
};
