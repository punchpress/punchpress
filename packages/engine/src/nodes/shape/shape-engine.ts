import {
  DEFAULT_VECTOR_STROKE_LINE_CAP,
  DEFAULT_VECTOR_STROKE_LINE_JOIN,
  DEFAULT_VECTOR_STROKE_MITER_LIMIT,
} from "@punchpress/punch-schema";
import {
  buildRoundedPolygonPath,
  canRoundPolygonPoint,
  getPolygonCornerRadiusSummary,
} from "./shape-corner-controls";

const getStrokeInset = (node) => {
  return Math.max(node.strokeWidth / 2, 0);
};
const HANDLE_EPSILON = 0.01;
const ELLIPSE_KAPPA = 0.5522847498307936;

const getDefaultPolygonPoints = (node) => {
  const halfWidth = node.width / 2;
  const halfHeight = node.height / 2;

  return [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ];
};

const getPolygonPointsBounds = (points) => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
    minX: Math.min(...xs),
    minY: Math.min(...ys),
  };
};

const getPolygonShapePoints = (node) => {
  if (node?.shape === "polygon" && node.points?.length >= 3) {
    return node.points;
  }

  return getDefaultPolygonPoints(node);
};

const getStarShapePoints = (node) => {
  if (node?.shape === "star" && node.points?.length >= 3) {
    return node.points;
  }

  return getStarPoints(node);
};

const getEllipseShapeContours = (node) => {
  const radiusX = node.width / 2;
  const radiusY = node.height / 2;
  const handleX = radiusX * ELLIPSE_KAPPA;
  const handleY = radiusY * ELLIPSE_KAPPA;

  return [
    {
      closed: true,
      segments: [
        {
          handleIn: { x: -handleX, y: 0 },
          handleOut: { x: handleX, y: 0 },
          point: { x: 0, y: -radiusY },
          pointType: "smooth",
        },
        {
          handleIn: { x: 0, y: -handleY },
          handleOut: { x: 0, y: handleY },
          point: { x: radiusX, y: 0 },
          pointType: "smooth",
        },
        {
          handleIn: { x: handleX, y: 0 },
          handleOut: { x: -handleX, y: 0 },
          point: { x: 0, y: radiusY },
          pointType: "smooth",
        },
        {
          handleIn: { x: 0, y: handleY },
          handleOut: { x: 0, y: -handleY },
          point: { x: -radiusX, y: 0 },
          pointType: "smooth",
        },
      ],
    },
  ];
};

const getClosedShapeBounds = (points, strokeInset) => {
  const { maxX, maxY, minX, minY } = getPolygonPointsBounds(points);

  return {
    height: maxY - minY + strokeInset * 2,
    maxX: maxX + strokeInset,
    maxY: maxY + strokeInset,
    minX: minX - strokeInset,
    minY: minY - strokeInset,
    width: maxX - minX + strokeInset * 2,
  };
};

const toShapeContour = (points) => {
  return [
    {
      closed: true,
      segments: points.map((point) => ({
        handleIn: { x: 0, y: 0 },
        handleOut: { x: 0, y: 0 },
        point,
        pointType: "corner",
      })),
    },
  ];
};

export const getShapeNodeBounds = (node) => {
  const strokeInset = getStrokeInset(node);
  if ((node.shape === "polygon" || node.shape === "star") && node.points?.length) {
    return getClosedShapeBounds(
      node.shape === "polygon" ? getPolygonShapePoints(node) : getStarShapePoints(node),
      strokeInset
    );
  }

  const halfWidth = node.width / 2;
  const halfHeight = node.height / 2;

  return {
    height: node.height + strokeInset * 2,
    maxX: halfWidth + strokeInset,
    maxY: halfHeight + strokeInset,
    minX: -halfWidth - strokeInset,
    minY: -halfHeight - strokeInset,
    width: node.width + strokeInset * 2,
  };
};

const buildPolygonPath = (node) => {
  const [
    topLeft,
    topRight,
    bottomRight,
    bottomLeft,
  ] = getDefaultPolygonPoints(node);

  return `M ${topLeft.x} ${topLeft.y} L ${topRight.x} ${topRight.y} L ${bottomRight.x} ${bottomRight.y} L ${bottomLeft.x} ${bottomLeft.y} Z`;
};

const buildEllipsePath = (node) => {
  const radiusX = node.width / 2;
  const radiusY = node.height / 2;

  return `M ${-radiusX} 0 A ${radiusX} ${radiusY} 0 1 0 ${radiusX} 0 A ${radiusX} ${radiusY} 0 1 0 ${-radiusX} 0 Z`;
};

const getStarPoint = (radiusX, radiusY, angle) => {
  return {
    x: Math.cos(angle) * radiusX,
    y: Math.sin(angle) * radiusY,
  };
};

const getStarPoints = (node) => {
  const outerRadiusX = node.width / 2;
  const outerRadiusY = node.height / 2;
  const innerRadiusScale = 0.45;
  const innerRadiusX = outerRadiusX * innerRadiusScale;
  const innerRadiusY = outerRadiusY * innerRadiusScale;
  const step = Math.PI / 5;
  const points = Array.from({ length: 10 }, (_, index) => {
    const isOuterPoint = index % 2 === 0;
    const angle = -Math.PI / 2 + step * index;

    return getStarPoint(
      isOuterPoint ? outerRadiusX : innerRadiusX,
      isOuterPoint ? outerRadiusY : innerRadiusY,
      angle
    );
  });

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return points.map((point) => ({
    x: ((point.x - minX) / (maxX - minX) - 0.5) * node.width,
    y: ((point.y - minY) / (maxY - minY) - 0.5) * node.height,
  }));
};

const buildStarPath = (node) => {
  const points = getStarPoints(node);

  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${point.x} ${point.y}`;
    })
    .concat("Z")
    .join(" ");
};

const buildEditablePolygonPath = (node) => {
  const points = getPolygonShapePoints(node);

  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${point.x} ${point.y}`;
    })
    .concat("Z")
    .join(" ");
};

const buildEditableStarPath = (node) => {
  const points = getStarShapePoints(node);

  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${point.x} ${point.y}`;
    })
    .concat("Z")
    .join(" ");
};

const getShapeOperationContoursValid = (contours) => {
  return Boolean(
    contours?.length === 1 && contours[0]?.closed && contours[0].segments.length >= 3
  );
};

const hasBezierSegments = (contours) => {
  return contours.some((contour) =>
    contour.segments.some((segment) => {
      return (
        segment.pointType !== "corner" ||
        Math.hypot(segment.handleIn.x, segment.handleIn.y) > HANDLE_EPSILON ||
        Math.hypot(segment.handleOut.x, segment.handleOut.y) > HANDLE_EPSILON
      );
    })
  );
};

const toShapePoints = (contours) => {
  return contours[0].segments.map((segment) => ({
    x: segment.point.x,
    y: segment.point.y,
  }));
};

export const canRoundShapePoint = (node, point) => {
  if (!(node?.shape === "polygon" && point)) {
    return false;
  }

  const contours = getShapeEditablePathContours(node);
  const contour = contours?.[point.contourIndex];
  const segment = contour?.segments?.[point.segmentIndex];

  if (!(contour && segment && segment.pointType === "corner")) {
    return false;
  }

  const points = contour.segments.map((currentSegment) => currentSegment.point);

  return canRoundPolygonPoint(points, point);
};

export const getShapePointCornerRadius = (node, point) => {
  const control = getShapePointCornerControl(node, point);

  if (!control) {
    return 0;
  }

  return control.currentRadius;
};

export const getShapePointCornerControl = (node, point) => {
  if (!(node?.shape === "polygon" && point)) {
    return null;
  }

  const contours = getShapeEditablePathContours(node);
  const contour = contours?.[point.contourIndex];
  const segment = contour?.segments?.[point.segmentIndex];

  if (!(contour && segment && segment.pointType === "corner")) {
    return null;
  }

  const points = contour.segments.map((currentSegment) => currentSegment.point);
  const cornerSummary = getPolygonCornerRadiusSummary(points, node.cornerRadius);

  if (!cornerSummary) {
    return null;
  }

  return {
    currentRadius: cornerSummary.value ?? 0,
    maxRadius: cornerSummary.max,
  };
};

export const getShapeCornerRadiusSummary = (node) => {
  if (node?.shape !== "polygon") {
    return null;
  }

  return getPolygonCornerRadiusSummary(
    getPolygonShapePoints(node),
    node.cornerRadius
  );
};

export const createVectorNodeFromShapeContours = (node, contours) => {
  return {
    contours,
    fill: node.fill,
    fillRule: "nonzero",
    id: node.id,
    parentId: node.parentId,
    stroke: node.stroke,
    strokeLineCap: DEFAULT_VECTOR_STROKE_LINE_CAP,
    strokeLineJoin: DEFAULT_VECTOR_STROKE_LINE_JOIN,
    strokeMiterLimit: DEFAULT_VECTOR_STROKE_MITER_LIMIT,
    strokeWidth: node.strokeWidth,
    transform: node.transform,
    type: "vector",
    visible: node.visible,
  };
};

export const supportsShapeEditablePath = (node) => {
  return node?.shape === "polygon" || node?.shape === "star" || node?.shape === "ellipse";
};

export const getShapeEditablePathContours = (node) => {
  if (!supportsShapeEditablePath(node)) {
    return null;
  }

  switch (node.shape) {
    case "ellipse":
      return getEllipseShapeContours(node);
    case "star":
      return toShapeContour(getStarShapePoints(node));
    case "polygon":
    default:
      return toShapeContour(getPolygonShapePoints(node));
  }
};

export const getShapePathEditResult = (
  node,
  contours,
  operation = "replace"
) => {
  if (!(supportsShapeEditablePath(node) && contours?.length > 0)) {
    return null;
  }

  if (node.shape === "ellipse") {
    return {
      kind: "vector",
      node: createVectorNodeFromShapeContours(node, contours),
    };
  }

  if (!getShapeOperationContoursValid(contours)) {
    return null;
  }

  const shouldConvertToVector =
    hasBezierSegments(contours) ||
    operation === "point-type" ||
    (node.shape === "star" && (operation === "insert" || operation === "delete"));

  if (shouldConvertToVector) {
    return {
      kind: "vector",
      node: createVectorNodeFromShapeContours(node, contours),
    };
  }

  const points = toShapePoints(contours);
  const { maxX, maxY, minX, minY } = getPolygonPointsBounds(points);

  return {
    kind: "shape",
    patch: {
      height: maxY - minY,
      points,
      shape: node.shape,
      width: maxX - minX,
    },
  };
};

export const buildShapeNodePath = (node) => {
  switch (node.shape) {
    case "polygon":
      return node.cornerRadius > 0
        ? buildRoundedPolygonPath(
            getPolygonShapePoints(node),
            node.cornerRadius
          )
        : node.points?.length >= 3
          ? buildEditablePolygonPath(node)
          : buildPolygonPath(node);
    case "star":
      return node.points?.length >= 3
        ? buildEditableStarPath(node)
        : buildStarPath(node);
    case "ellipse":
      return buildEllipsePath(node);
    default:
      return buildPolygonPath(node);
  }
};
