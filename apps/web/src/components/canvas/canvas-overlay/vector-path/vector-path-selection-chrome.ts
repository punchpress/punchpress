const isSamePathPoint = (a, b) => {
  return Boolean(
    a &&
      b &&
      a.contourIndex === b.contourIndex &&
      a.segmentIndex === b.segmentIndex
  );
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

  if (isSamePathPoint(selectedPoint, point)) {
    return true;
  }

  const control = editor.getPathPointCornerControl(nodeId, selectedPoint);

  return Boolean(
    control?.kind === "detected" &&
      control.contourIndex === point.contourIndex &&
      (control.startIndex === point.segmentIndex ||
        control.endIndex === point.segmentIndex)
  );
};
