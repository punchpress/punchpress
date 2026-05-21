import type { PointerEvent } from "react";

interface CanvasGuideProps {
  activePathD: string;
  height: number;
  isEditing: boolean;
  onActivePathPointerDown?: (event: PointerEvent<SVGPathElement>) => void;
  pathD: string;
  transform: string;
  width: number;
}

export const CanvasGuide = ({
  activePathD,
  height,
  isEditing,
  onActivePathPointerDown,
  pathD,
  transform,
  width,
}: CanvasGuideProps) => {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full overflow-visible"
      data-guide-state={isEditing ? "editing" : "idle"}
      data-testid="text-path-guide"
      height={height}
      width={width}
    >
      <g transform={transform}>
        <path className="canvas-guide" d={pathD} data-role="passive" />
        <path className="canvas-guide" d={activePathD} data-role="active" />
        {onActivePathPointerDown ? (
          <path
            className="canvas-guide-hit-target"
            d={activePathD}
            onPointerDown={onActivePathPointerDown}
          />
        ) : null}
      </g>
    </svg>
  );
};
