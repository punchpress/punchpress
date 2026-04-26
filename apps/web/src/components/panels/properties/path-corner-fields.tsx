import { useRef } from "react";
import { ScrubSlider } from "@/components/ui/scrub-slider";
import { useEditor } from "../../../editor-react/use-editor";
import { useCornerSliderPresentation } from "./corner-slider-presentation";
import { FieldRow, Section } from "./field-primitives";

const CORNER_RADIUS_RANGE = { min: 0 };
const CORNER_RADIUS_KEYBOARD_STEP = 1;
const CORNER_RADIUS_STEP = 0.01;
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
  const currentValue = cornerSummary?.value ?? 0;
  const {
    displayValue,
    preserveDisplayValueWhileDragging,
    valueBadge,
    visualMax,
  } = useCornerSliderPresentation({
    currentValue,
    formatValue: formatCornerRadiusDisplay,
    isMixed: Boolean(cornerSummary?.isMixed),
    max: cornerStableMax || cornerSummary?.max || 0,
  });

  if (!(selectedNode && cornerSummary)) {
    return null;
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
          preserveDisplayValueWhileDragging={preserveDisplayValueWhileDragging}
          step={CORNER_RADIUS_STEP}
          value={currentValue}
          valueBadge={valueBadge}
        />
      </FieldRow>
    </Section>
  );
};
