import { useId } from "react";

interface PixelGridBounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface PixelGridPlane {
  cellHeight: number;
  cellWidth: number;
  originX: number;
  originY: number;
}

interface PixelGridStrokeWidths {
  horizontal: number;
  vertical: number;
}

interface CanvasPixelGridPatternProps {
  bounds: PixelGridBounds;
  kind: "frame" | "raster";
  nodeId: string;
  plane: PixelGridPlane;
  sourceNodeId: string;
  strokeWidths: PixelGridStrokeWidths;
}

export const CanvasPixelGridPattern = ({
  bounds,
  kind,
  nodeId,
  plane,
  sourceNodeId,
  strokeWidths,
}: CanvasPixelGridPatternProps) => {
  const id = useId().replaceAll(":", "");

  return (
    <g
      data-pixel-grid-kind={kind}
      data-pixel-grid-node-id={nodeId}
      data-pixel-grid-source-node-id={sourceNodeId}
      pointerEvents="none"
    >
      <defs>
        <pattern
          data-testid="pixel-grid-pattern"
          height={plane.cellHeight}
          id={id}
          patternUnits="userSpaceOnUse"
          width={plane.cellWidth}
          x={plane.originX}
          y={plane.originY}
        >
          <path
            d={`M0 0V${plane.cellHeight}`}
            data-pixel-grid-tone="dark"
            stroke="#000"
            strokeOpacity="0.52"
            strokeWidth={strokeWidths.vertical * 2}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={`M0 0H${plane.cellWidth}`}
            data-pixel-grid-tone="dark"
            stroke="#000"
            strokeOpacity="0.52"
            strokeWidth={strokeWidths.horizontal * 2}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={`M0 0V${plane.cellHeight}`}
            data-pixel-grid-tone="light"
            stroke="#fff"
            strokeOpacity="0.72"
            strokeWidth={strokeWidths.vertical}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={`M0 0H${plane.cellWidth}`}
            data-pixel-grid-tone="light"
            stroke="#fff"
            strokeOpacity="0.72"
            strokeWidth={strokeWidths.horizontal}
            vectorEffect="non-scaling-stroke"
          />
        </pattern>
      </defs>
      <rect
        data-testid="pixel-grid-plane"
        fill={`url(#${id})`}
        height={bounds.height}
        width={bounds.width}
        x={bounds.x}
        y={bounds.y}
      />
    </g>
  );
};
