import { ScrubSlider } from "@/components/ui/scrub-slider";
import { useEditor } from "../../../editor-react/use-editor";
import { FieldRow, Section } from "./field-primitives";

const CORNER_RADIUS_RANGE = { min: 0 };

export const PathCornerFields = ({ cornerSummary, selectedNode }) => {
  const editor = useEditor();

  if (!(selectedNode && cornerSummary)) {
    return null;
  }

  return (
    <Section title="Path">
      <FieldRow label="Corners">
        <ScrubSlider
          ariaLabel="Path corner radius"
          displayValue={cornerSummary.isMixed ? "Mixed" : null}
          max={cornerSummary.max}
          min={CORNER_RADIUS_RANGE.min}
          onValueChange={(nextCornerRadius) => {
            editor.setPathCornerRadius(nextCornerRadius, selectedNode.id);
          }}
          value={cornerSummary.value ?? 0}
        />
      </FieldRow>
    </Section>
  );
};
