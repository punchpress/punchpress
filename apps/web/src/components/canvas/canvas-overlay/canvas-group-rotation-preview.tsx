export const CanvasGroupRotationPreview = ({ rect }) => {
  if (!rect) {
    return null;
  }

  return (
    <div
      className="canvas-group-rotation-preview pointer-events-none absolute"
      style={{
        height: `${rect.height}px`,
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
      }}
    />
  );
};
