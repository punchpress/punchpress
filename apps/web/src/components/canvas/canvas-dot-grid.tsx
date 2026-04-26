import { useId } from "react";
import {
  DOT_GRID_STEPS,
  getCanvasDotGridBucketProgress,
  getCanvasDotGridPatternOffset,
  getCanvasDotGridStepIndex,
  getCanvasDotGridStepOpacity,
} from "./canvas-dot-grid-math";

interface CanvasDotGridProps {
  originX: number;
  originY: number;
  stageMargin: number;
  zoom: number;
}

export const CanvasDotGrid = ({
  originX,
  originY,
  stageMargin,
  zoom,
}: CanvasDotGridProps) => {
  const id = useId().replace(/:/g, "_");

  const activeStepIndex = getCanvasDotGridStepIndex(zoom);
  const activeProgress = getCanvasDotGridBucketProgress(zoom, activeStepIndex);
  const dotRadius =
    Math.max(0.98, 1.18 - activeStepIndex * 0.035 - activeProgress * 0.14) /
    Math.max(zoom, 0.001);

  return (
    <svg
      aria-hidden="true"
      className="canvas-dot-grid pointer-events-none absolute"
      style={{
        height: `calc(100% + ${stageMargin * 2}px)`,
        left: `-${stageMargin}px`,
        top: `-${stageMargin}px`,
        width: `calc(100% + ${stageMargin * 2}px)`,
      }}
    >
      <defs>
        {DOT_GRID_STEPS.map(({ step }, index) => {
          const spacing = step;
          const opacity = getCanvasDotGridStepOpacity(zoom, index);

          if (!(spacing > 0 && opacity > 0)) {
            return null;
          }

          const offsetX = getCanvasDotGridPatternOffset(originX, spacing);
          const offsetY = getCanvasDotGridPatternOffset(originY, spacing);

          return (
            <pattern
              height={spacing}
              id={`${id}_${step}`}
              key={step}
              patternUnits="userSpaceOnUse"
              width={spacing}
            >
              <circle
                className="canvas-dot-grid-dot"
                cx={offsetX}
                cy={offsetY}
                opacity={opacity}
                r={dotRadius}
              />
            </pattern>
          );
        })}
      </defs>

      {DOT_GRID_STEPS.map(({ step }) => {
        return (
          <rect
            fill={`url(#${id}_${step})`}
            height="100%"
            key={step}
            width="100%"
          />
        );
      })}
    </svg>
  );
};
