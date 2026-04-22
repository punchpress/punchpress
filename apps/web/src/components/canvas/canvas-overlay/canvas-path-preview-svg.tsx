interface CanvasPathPreviewSvgProps {
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

const PATH_PREVIEW_STROKE_WIDTH_PX = 1.75;

export const CanvasPathPreviewSvg = ({
  bbox,
  paths,
}: CanvasPathPreviewSvgProps) => {
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
              className="canvas-path-preview"
              d={path.d}
              fill="none"
              key={path.key || `${path.transform || "preview"}-${path.d}`}
              stroke="var(--canvas-path-preview-stroke)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={PATH_PREVIEW_STROKE_WIDTH_PX}
              transform={path.transform || undefined}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </g>
    </svg>
  );
};
