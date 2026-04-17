import { useRef } from "react";
import { ScrubSlider } from "@/components/ui/scrub-slider";
import { useEditor } from "../../../editor-react/use-editor";
import { FieldRow, Section } from "./field-primitives";

const CORNER_RADIUS_RANGE = { min: 0 };
const CORNER_RADIUS_KEYBOARD_STEP = 1;
const CORNER_RADIUS_STEP = 0.01;
const formatCornerRadiusDisplay = (value: number) => {
  return Math.round(value).toString();
};

export const PathPointFields = ({
  cornerMax,
  cornerRadius,
  selectedNode,
  selectedPathPoint,
}) => {
  const editor = useEditor();
  const scrubSourceNodeRef = useRef(null);

  if (!(selectedNode && selectedPathPoint)) {
    return null;
  }

  return (
    <Section title="Point">
      <FieldRow label="Corner">
        <ScrubSlider
          ariaLabel="Point corner radius"
          formatValue={formatCornerRadiusDisplay}
          keyboardStep={CORNER_RADIUS_KEYBOARD_STEP}
          max={cornerMax}
          min={CORNER_RADIUS_RANGE.min}
          onScrubEnd={() => {
            scrubSourceNodeRef.current = null;
          }}
          onScrubStart={() => {
            scrubSourceNodeRef.current = editor.getNode(selectedNode.id);
          }}
          onValueChange={(nextCornerRadius) => {
            editor.setPathPointCornerRadius(
              nextCornerRadius,
              selectedNode.id,
              selectedPathPoint,
              scrubSourceNodeRef.current
            );
          }}
          step={CORNER_RADIUS_STEP}
          value={cornerRadius ?? 0}
        />
      </FieldRow>
    </Section>
  );
};
