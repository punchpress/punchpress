const isSamePathPoint = (a, b) => {
  return Boolean(
    a &&
      b &&
      a.contourIndex === b.contourIndex &&
      a.segmentIndex === b.segmentIndex
  );
};

const getSelectedDetectedCornerControl = (editor, nodeId, selectedPoint) => {
  const control =
    nodeId && selectedPoint
      ? editor.getPathPointCornerControl(nodeId, selectedPoint)
      : null;

  return control?.kind === "detected" ? control : null;
};

const isPointInSelectedDetectedCorner = (
  editor,
  nodeId,
  selectedPoint,
  point
) => {
  const control = getSelectedDetectedCornerControl(
    editor,
    nodeId,
    selectedPoint
  );

  return Boolean(
    control &&
      point &&
      control.contourIndex === point.contourIndex &&
      (control.startIndex === point.segmentIndex ||
        control.endIndex === point.segmentIndex)
  );
};

export const shouldShowSelectedAnchorForPoint = (
  editor,
  nodeId,
  selectedPoints,
  selectedPoint,
  point
) => {
  if (
    !(
      point &&
      selectedPoints?.some((currentPoint) =>
        isSamePathPoint(currentPoint, point)
      )
    )
  ) {
    return false;
  }

  return !isPointInSelectedDetectedCorner(editor, nodeId, selectedPoint, point);
};

export const shouldShowBezierHandlesForPoint = (
  editor,
  nodeId,
  selectedPoint,
  point
) => {
  if (!(nodeId && selectedPoint && point)) {
    return false;
  }

  if (isPointInSelectedDetectedCorner(editor, nodeId, selectedPoint, point)) {
    return false;
  }

  if (isSamePathPoint(selectedPoint, point)) {
    return true;
  }

  return false;
};
