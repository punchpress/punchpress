import { ScrubSlider } from "@/components/ui/scrub-slider";
import { useEditor } from "../../../editor-react/use-editor";
import { ColorField, FieldRow, Section } from "./field-primitives";

const BRUSH_SIZE_RANGE = { max: 500, min: 1 };
const BRUSH_PERCENT_RANGE = { max: 100, min: 0 };
const BRUSH_SPACING_RANGE = { max: 200, min: 0 };

const formatPercent = (value) => `${Math.round(value)}%`;

export const BrushFields = ({ settings, tool }) => {
  const editor = useEditor();

  if (!settings) {
    return null;
  }

  const title = tool === "eraser" ? "Eraser" : "Brush";
  const showColor = tool !== "eraser";

  return (
    <Section title={title}>
      {showColor ? (
        <FieldRow label="Color">
          <ColorField
            onChange={(color) => editor.setBrushSettings({ color }, tool)}
            stateKey="brush-color"
            value={settings.color}
          />
        </FieldRow>
      ) : null}

      <FieldRow label="Size">
        <ScrubSlider
          ariaLabel="Brush size"
          max={BRUSH_SIZE_RANGE.max}
          min={BRUSH_SIZE_RANGE.min}
          onValueChange={(size) => {
            editor.setBrushSettings({ size }, tool);
          }}
          scrubMax={120}
          scrubMin={BRUSH_SIZE_RANGE.min}
          value={settings.size}
        />
      </FieldRow>

      <FieldRow label="Opacity">
        <ScrubSlider
          ariaLabel="Brush opacity"
          formatValue={formatPercent}
          max={BRUSH_PERCENT_RANGE.max}
          min={BRUSH_PERCENT_RANGE.min}
          onValueChange={(opacity) => {
            editor.setBrushSettings({ opacity: opacity / 100 }, tool);
          }}
          value={Math.round(settings.opacity * 100)}
        />
      </FieldRow>

      <FieldRow label="Hardness">
        <ScrubSlider
          ariaLabel="Brush hardness"
          formatValue={formatPercent}
          max={BRUSH_PERCENT_RANGE.max}
          min={BRUSH_PERCENT_RANGE.min}
          onValueChange={(hardness) => {
            editor.setBrushSettings({ hardness: hardness / 100 }, tool);
          }}
          value={Math.round(settings.hardness * 100)}
        />
      </FieldRow>

      <FieldRow label="Spacing">
        <ScrubSlider
          ariaLabel="Brush spacing"
          formatValue={formatPercent}
          max={BRUSH_SPACING_RANGE.max}
          min={BRUSH_SPACING_RANGE.min}
          onValueChange={(spacing) => {
            editor.setBrushSettings({ spacing: spacing / 100 }, tool);
          }}
          value={Math.round(settings.spacing * 100)}
        />
      </FieldRow>
    </Section>
  );
};
