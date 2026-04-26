import { useRef } from "react";

const CORNER_RADIUS_MAX_ENTER_EPSILON = 0.15;
const CORNER_RADIUS_MAX_EXIT_EPSILON = 0.5;

export const useCornerSliderPresentation = ({
  currentValue,
  formatValue,
  isMixed,
  max,
}: {
  currentValue: number;
  formatValue: (value: number) => string;
  isMixed: boolean;
  max: number;
}) => {
  const cappedPresentationRef = useRef({
    isPinned: false,
    value: 0,
  });
  const rawVisualMax = Math.max(max || 0, currentValue);
  const canStayPinned =
    cappedPresentationRef.current.isPinned &&
    currentValue >=
      cappedPresentationRef.current.value - CORNER_RADIUS_MAX_EXIT_EPSILON;
  const shouldPinToMax = Boolean(
    !isMixed &&
      rawVisualMax > 0 &&
      (canStayPinned ||
        currentValue >= rawVisualMax - CORNER_RADIUS_MAX_ENTER_EPSILON)
  );

  let visualMax = rawVisualMax;
  let displayValue: string | null = null;

  if (shouldPinToMax) {
    visualMax = canStayPinned
      ? Math.max(
          cappedPresentationRef.current.value,
          rawVisualMax,
          currentValue
        )
      : rawVisualMax;
    cappedPresentationRef.current = {
      isPinned: true,
      value: visualMax,
    };
  } else {
    cappedPresentationRef.current = {
      isPinned: false,
      value: rawVisualMax,
    };
  }

  if (isMixed) {
    displayValue = "Mixed";
  } else if (shouldPinToMax) {
    displayValue = formatValue(visualMax);
  }

  return {
    displayValue,
    preserveDisplayValueWhileDragging: shouldPinToMax,
    valueBadge: shouldPinToMax ? "Max" : null,
    visualMax,
  };
};
