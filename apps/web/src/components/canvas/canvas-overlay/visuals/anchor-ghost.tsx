const GHOST_ANCHOR_SIZE_PX = 12;

const projectPoint = (matrix, point) => {
  return {
    x: point.x * matrix.a + point.y * matrix.c + matrix.e,
    y: point.x * matrix.b + point.y * matrix.d + matrix.f,
  };
};

export const CanvasAnchorGhost = ({ matrix, penHover }) => {
  if (!(matrix && penHover?.intent === "add" && penHover.role === "segment")) {
    return null;
  }

  const point = projectPoint(matrix, penHover.point);

  return (
    <div
      aria-hidden="true"
      className="canvas-anchor-ghost"
      data-testid="canvas-pen-insert-ghost-anchor"
      style={{
        height: `${GHOST_ANCHOR_SIZE_PX}px`,
        left: `${point.x}px`,
        opacity: 0.72,
        top: `${point.y}px`,
        transform: "translate(-50%, -50%)",
        width: `${GHOST_ANCHOR_SIZE_PX}px`,
      }}
    />
  );
};
