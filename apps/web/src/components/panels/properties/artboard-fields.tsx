import { useEditor } from "../../../editor-react/use-editor";
import { ColorField, FieldRow, Section } from "./field-primitives";
import { NumberField } from "./number-field";

export const ArtboardFields = ({ background, height, node, width }) => {
  const editor = useEditor();

  if (!(node && width && height && background)) {
    return null;
  }

  return (
    <Section title="Frame">
      <FieldRow label="Width">
        <NumberField
          min={1}
          onValueChange={(nextWidth) => {
            editor.setSelectionProperty("width", nextWidth);
          }}
          value={width.value ?? node.width}
        />
      </FieldRow>

      <FieldRow label="Height">
        <NumberField
          min={1}
          onValueChange={(nextHeight) => {
            editor.setSelectionProperty("height", nextHeight);
          }}
          value={height.value ?? node.height}
        />
      </FieldRow>

      <FieldRow label="Color">
        <ColorField
          onChange={(nextBackground) => {
            editor.setSelectionProperty("background", nextBackground);
          }}
          placeholder={background.isMixed ? "Mixed" : undefined}
          stateKey="artboard-background"
          value={background.isMixed ? null : background.value}
        />
      </FieldRow>
    </Section>
  );
};
