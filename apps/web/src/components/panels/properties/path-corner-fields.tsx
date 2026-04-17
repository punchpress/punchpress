import { useRef } from "react";
import { ScrubSlider } from "@/components/ui/scrub-slider";
import { useEditor } from "../../../editor-react/use-editor";
import { FieldRow, Section } from "./field-primitives";

const CORNER_RADIUS_RANGE = { min: 0 };
const CORNER_RADIUS_KEYBOARD_STEP = 1;
const CORNER_RADIUS_STEP = 0.01;
const CORNER_RADIUS_MAX_ENTER_EPSILON = 0.15;
const CORNER_RADIUS_MAX_EXIT_EPSILON = 0.5;
const formatCornerRadiusDisplay = (value: number) => {
  return Math.round(value).toString();
};

export const PathCornerFields = ({
  cornerStableMax,
  cornerSummary,
  selectedNode,
}) => {
  const editor = useEditor();
  const scrubSourceNodeRef = useRef(null);
  const cappedPresentationRef = useRef({
    isPinned: false,
    value: 0,
  });

  if (!(selectedNode && cornerSummary)) {
    return null;
  }

  const currentValue = cornerSummary.value ?? 0;
  const rawVisualMax = Math.max(cornerStableMax || 0, currentValue);
  const canStayPinned =
    cappedPresentationRef.current.isPinned &&
    currentValue >=
      cappedPresentationRef.current.value - CORNER_RADIUS_MAX_EXIT_EPSILON;
  const shouldPinToMax = Boolean(
    !cornerSummary.isMixed &&
      rawVisualMax > 0 &&
      (canStayPinned ||
        currentValue >= rawVisualMax - CORNER_RADIUS_MAX_ENTER_EPSILON)
  );

  let visualMax = rawVisualMax;
  let displayValue: string | null = null;

  if (shouldPinToMax) {
    visualMax = Math.max(
      cappedPresentationRef.current.value,
      rawVisualMax,
      currentValue
    );
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

  if (cornerSummary.isMixed) {
    displayValue = "Mixed";
  } else if (shouldPinToMax) {
    displayValue = formatCornerRadiusDisplay(visualMax);
  }

  return (
    <Section title="Path">
      <FieldRow label="Corners">
        <ScrubSlider
          ariaLabel="Path corner radius"
          displayValue={displayValue}
          formatValue={formatCornerRadiusDisplay}
          keyboardStep={CORNER_RADIUS_KEYBOARD_STEP}
          max={visualMax || cornerSummary.max}
          min={CORNER_RADIUS_RANGE.min}
          onScrubEnd={() => {
            scrubSourceNodeRef.current = null;
          }}
          onScrubStart={() => {
            scrubSourceNodeRef.current = editor.getNode(selectedNode.id);
          }}
          onValueChange={(nextCornerRadius) => {
            editor.setPathCornerRadius(
              nextCornerRadius,
              selectedNode.id,
              scrubSourceNodeRef.current
            );
          }}
          preserveDisplayValueWhileDragging={shouldPinToMax}
          step={CORNER_RADIUS_STEP}
          value={currentValue}
          valueBadge={shouldPinToMax ? "Max" : null}
        />
      </FieldRow>
    </Section>
  );
};
