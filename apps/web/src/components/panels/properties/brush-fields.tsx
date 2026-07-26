import { RASTER_BRUSH_PRESETS } from "@punchpress/engine";
import { ScrubSlider } from "@/components/ui/scrub-slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditor } from "../../../editor-react/use-editor";
import { ColorField, FieldRow, Section } from "./field-primitives";

const BRUSH_ANGLE_RANGE = { max: 180, min: -180 };
const BRUSH_SIZE_RANGE = { max: 500, min: 1 };
const BRUSH_PERCENT_RANGE = { max: 100, min: 0 };
const BRUSH_ROUNDNESS_RANGE = { max: 100, min: 1 };
const BRUSH_SPACING_RANGE = { max: 200, min: 0 };

const formatPercent = (value) => `${Math.round(value)}%`;
const formatAngle = (value) => `${Math.round(value)}°`;

export const BrushFields = ({ presetId, settings, tool }) => {
  const editor = useEditor();
  const selectedPreset = RASTER_BRUSH_PRESETS.find(
    (preset) => preset.id === presetId
  );

  if (!settings) {
    return null;
  }

  const title = tool === "eraser" ? "Eraser" : "Brush";
  const showColor = tool !== "eraser";

  return (
    <Section title={title}>
      <FieldRow label="Preset">
        <Select
          onValueChange={(nextPresetId) => {
            editor.selectBrushPreset(nextPresetId, tool);
          }}
          value={presetId}
        >
          <SelectTrigger aria-label="Brush preset" size="sm">
            <SelectValue>{() => selectedPreset?.name ?? null}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {RASTER_BRUSH_PRESETS.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

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

      <FieldRow label="Flow">
        <ScrubSlider
          ariaLabel="Brush flow"
          formatValue={formatPercent}
          max={BRUSH_PERCENT_RANGE.max}
          min={BRUSH_PERCENT_RANGE.min}
          onValueChange={(flow) => {
            editor.setBrushSettings({ flow: flow / 100 }, tool);
          }}
          value={Math.round(settings.flow * 100)}
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

      <FieldRow label="Angle">
        <ScrubSlider
          ariaLabel="Brush angle"
          formatValue={formatAngle}
          max={BRUSH_ANGLE_RANGE.max}
          min={BRUSH_ANGLE_RANGE.min}
          onValueChange={(angle) => {
            editor.setBrushSettings({ angle }, tool);
          }}
          value={settings.angle}
        />
      </FieldRow>

      <FieldRow label="Roundness">
        <ScrubSlider
          ariaLabel="Brush roundness"
          formatValue={formatPercent}
          max={BRUSH_ROUNDNESS_RANGE.max}
          min={BRUSH_ROUNDNESS_RANGE.min}
          onValueChange={(roundness) => {
            editor.setBrushSettings({ roundness: roundness / 100 }, tool);
          }}
          value={Math.round(settings.roundness * 100)}
        />
      </FieldRow>

      <FieldRow label="Smoothing">
        <ScrubSlider
          ariaLabel="Brush smoothing"
          formatValue={formatPercent}
          max={BRUSH_PERCENT_RANGE.max}
          min={BRUSH_PERCENT_RANGE.min}
          onValueChange={(smoothing) => {
            editor.setBrushSettings({ smoothing: smoothing / 100 }, tool);
          }}
          value={Math.round(settings.smoothing * 100)}
        />
      </FieldRow>

      <FieldRow label="Scatter">
        <ScrubSlider
          ariaLabel="Brush scatter"
          formatValue={formatPercent}
          max={BRUSH_PERCENT_RANGE.max}
          min={BRUSH_PERCENT_RANGE.min}
          onValueChange={(scatter) => {
            editor.setBrushSettings({ scatter: scatter / 100 }, tool);
          }}
          value={Math.round(settings.scatter * 100)}
        />
      </FieldRow>

      <FieldRow label="Size jitter">
        <ScrubSlider
          ariaLabel="Brush size jitter"
          formatValue={formatPercent}
          max={BRUSH_PERCENT_RANGE.max}
          min={BRUSH_PERCENT_RANGE.min}
          onValueChange={(sizeJitter) => {
            editor.setBrushSettings({ sizeJitter: sizeJitter / 100 }, tool);
          }}
          value={Math.round(settings.sizeJitter * 100)}
        />
      </FieldRow>

      <FieldRow label="Angle jitter">
        <ScrubSlider
          ariaLabel="Brush angle jitter"
          formatValue={formatPercent}
          max={BRUSH_PERCENT_RANGE.max}
          min={BRUSH_PERCENT_RANGE.min}
          onValueChange={(angleJitter) => {
            editor.setBrushSettings({ angleJitter: angleJitter / 100 }, tool);
          }}
          value={Math.round(settings.angleJitter * 100)}
        />
      </FieldRow>
    </Section>
  );
};
