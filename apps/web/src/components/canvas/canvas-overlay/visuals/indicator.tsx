interface CanvasIndicatorProps {
  bbox: {
    height: number;
    maxX: number;
    maxY: number;
    minX: number;
    minY: number;
    width: number;
  };
  paths: Array<{
    d: string;
    key?: string;
    transform?: string | null;
  }>;
}

export const CanvasIndicator = ({ bbox, paths }: CanvasIndicatorProps) => {
  const width = Math.max(1, bbox.width);
  const height = Math.max(1, bbox.height);

  return (
    <svg
      aria-hidden="true"
      className="block overflow-visible"
      focusable="false"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      <g transform={`translate(${-bbox.minX} ${-bbox.minY})`}>
        {paths.map((path) => {
          return (
            <path
              className="canvas-indicator canvas-preview"
              d={path.d}
              key={path.key || `${path.transform || "preview"}-${path.d}`}
              transform={path.transform || undefined}
            />
          );
        })}
      </g>
    </svg>
  );
};
