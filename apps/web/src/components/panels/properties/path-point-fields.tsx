import { ScrubSlider } from "@/components/ui/scrub-slider";
import { useEditor } from "../../../editor-react/use-editor";
import { FieldRow, Section } from "./field-primitives";

const CORNER_RADIUS_RANGE = { min: 0 };

export const PathPointFields = ({
  cornerMax,
  cornerRadius,
  selectedNode,
  selectedPathPoint,
}) => {
  const editor = useEditor();

  if (!(selectedNode && selectedPathPoint)) {
    return null;
  }

  return (
    <Section title="Point">
      <FieldRow label="Corner">
        <ScrubSlider
          ariaLabel="Point corner radius"
          max={cornerMax}
          min={CORNER_RADIUS_RANGE.min}
          onValueChange={(nextCornerRadius) => {
            editor.setPathPointCornerRadius(
              nextCornerRadius,
              selectedNode.id,
              selectedPathPoint
            );
          }}
          value={cornerRadius ?? 0}
        />
      </FieldRow>
    </Section>
  );
};
