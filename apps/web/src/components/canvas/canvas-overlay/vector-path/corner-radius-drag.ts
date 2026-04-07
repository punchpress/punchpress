import {
  setAllVectorPointCornerRadii,
  setVectorPointCornerRadius,
} from "@punchpress/engine";

export const getVectorCornerRadiusDragContours = ({
  contours,
  dragScope,
  point,
  radius,
  selectedPoints = [],
}) => {
  if (!(contours && point)) {
    return null;
  }

  if (dragScope === "all") {
    return setAllVectorPointCornerRadii(contours, radius);
  }

  if (dragScope === "selected" && selectedPoints.length > 0) {
    return setAllVectorPointCornerRadii(contours, radius, selectedPoints);
  }

  return setVectorPointCornerRadius(contours, point, radius);
};
