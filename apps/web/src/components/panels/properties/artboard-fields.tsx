import { PERF_COUNTERS } from "@punchpress/engine";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { usePerformanceRenderCounter } from "../../../performance/use-performance-render-counter";
import { ColorField, FieldPair, FieldRow, Section } from "./field-primitives";
import { NumberField } from "./number-field";

export const ArtboardFields = ({ nodeId }: { nodeId: string }) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesSection);
  const editor = useEditor();
  const fields = useEditorValue((editor, state) => {
    const node = editor.getNode(nodeId);
    const read = (propertyId: string) => {
      return editor.getSelectionProperty(propertyId, state.selectedNodeIds);
    };
    const width = read("width");
    const height = read("height");
    const background = read("background");

    return {
      available: Boolean(node && width && height && background),
      background: background?.isMixed ? null : background?.value,
      height: height?.value ?? node?.height,
      isBackgroundMixed: Boolean(background?.isMixed),
      width: width?.value ?? node?.width,
    };
  });

  if (!fields.available) {
    return null;
  }

  return (
    <Section title="Frame">
      <FieldPair label="Size">
        <FieldRow label="Width">
          <NumberField
            min={1}
            onValueChange={(nextWidth) => {
              editor.setSelectionProperty("width", nextWidth);
            }}
            value={fields.width}
          />
        </FieldRow>

        <FieldRow label="Height">
          <NumberField
            min={1}
            onValueChange={(nextHeight) => {
              editor.setSelectionProperty("height", nextHeight);
            }}
            value={fields.height}
          />
        </FieldRow>
      </FieldPair>

      <FieldRow label="Color">
        <ColorField
          onChange={(nextBackground) => {
            editor.setSelectionProperty("background", nextBackground);
          }}
          placeholder={fields.isBackgroundMixed ? "Mixed" : undefined}
          stateKey="artboard-background"
          value={fields.background}
        />
      </FieldRow>
    </Section>
  );
};
