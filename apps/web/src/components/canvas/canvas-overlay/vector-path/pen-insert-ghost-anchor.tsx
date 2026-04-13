const GHOST_ANCHOR_SIZE_PX = 12;

const projectPoint = (matrix, point) => {
  return {
    x: point.x * matrix.a + point.y * matrix.c + matrix.e,
    y: point.x * matrix.b + point.y * matrix.d + matrix.f,
  };
};

export const PenInsertGhostAnchor = ({ matrix, penHover }) => {
  if (!(matrix && penHover?.intent === "add" && penHover.role === "segment")) {
    return null;
  }

  const point = projectPoint(matrix, penHover.point);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute rounded-full border-2 border-[color:var(--canvas-handle-accent)] bg-[color:color-mix(in_srgb,var(--background)_70%,transparent)] shadow-[0_1px_3px_rgba(0,0,0,0.18)]"
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
