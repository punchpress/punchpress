import { ScrubSlider } from "@/components/ui/scrub-slider";
import { useEditor } from "../../../editor-react/use-editor";
import { FieldRow, Section } from "./field-primitives";
import { usePropertyScrubHistory } from "./use-property-scrub-history";

const IMAGE_SIZE_RANGE = { min: 1, max: 5000 };

export const ImageFields = ({ height, node, width }) => {
  const editor = useEditor();
  const scrubHistory = usePropertyScrubHistory("resize image");

  if (!(node && width && height)) {
    return null;
  }

  return (
    <Section title="Image">
      <FieldRow label="Width">
        <ScrubSlider
          ariaLabel="Image width"
          max={IMAGE_SIZE_RANGE.max}
          min={IMAGE_SIZE_RANGE.min}
          onValueChange={(nextWidth) => {
            editor.setSelectionProperty("width", nextWidth);
          }}
          {...scrubHistory}
          value={width.value ?? node.width}
        />
      </FieldRow>

      <FieldRow label="Height">
        <ScrubSlider
          ariaLabel="Image height"
          max={IMAGE_SIZE_RANGE.max}
          min={IMAGE_SIZE_RANGE.min}
          onValueChange={(nextHeight) => {
            editor.setSelectionProperty("height", nextHeight);
          }}
          {...scrubHistory}
          value={height.value ?? node.height}
        />
      </FieldRow>
    </Section>
  );
};
