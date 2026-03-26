const getStrokeInset = (node) => {
  return Math.max(node.strokeWidth / 2, 0);
};

export const getShapeNodeBounds = (node) => {
  const strokeInset = getStrokeInset(node);
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

const buildRectanglePath = (node) => {
  const halfWidth = node.width / 2;
  const halfHeight = node.height / 2;

  return `M ${-halfWidth} ${-halfHeight} L ${halfWidth} ${-halfHeight} L ${halfWidth} ${halfHeight} L ${-halfWidth} ${halfHeight} Z`;
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

export const buildShapeNodePath = (node) => {
  switch (node.shape) {
    case "ellipse":
      return buildEllipsePath(node);
    case "star":
      return buildStarPath(node);
    default:
      return buildRectanglePath(node);
  }
};
