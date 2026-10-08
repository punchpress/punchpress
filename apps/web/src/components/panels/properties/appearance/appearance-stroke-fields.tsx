import type { StrokeLayer } from "@punchpress/engine";
import { ScrubSlider } from "@/components/ui/scrub-slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditor } from "../../../../editor-react/use-editor";
import { useEditorValue } from "../../../../editor-react/use-editor-value";
import { FieldRow } from "../field-primitives";
import { usePropertyScrubHistory } from "../use-property-scrub-history";
import { useAppearanceLayer } from "./appearance-context";

const WIDTH_RANGE = { max: 1000, min: 0 };
const WIDTH_SCRUB_RANGE = { max: 50, min: 0 };
const MITER_RANGE = { max: 100, min: 1 };

const ALIGN_OPTIONS = [
  { label: "Center", value: "center" },
  { label: "Inside", value: "inside" },
  { label: "Outside", value: "outside" },
];

const CAP_OPTIONS = [
  { label: "Butt", value: "butt" },
  { label: "Round", value: "round" },
  { label: "Square", value: "square" },
];

const JOIN_OPTIONS = [
  { label: "Miter", value: "miter" },
  { label: "Round", value: "round" },
  { label: "Bevel", value: "bevel" },
];

// Alignment, width, cap, join, and (for miter joins) miter limit of one
// stroke layer. Each scrub is one undo step.
export const AppearanceStrokeFields = ({ layerId }: { layerId: string }) => {
  const editor = useEditor();
  const canAlign = useEditorValue((currentEditor) =>
    currentEditor.canAlignStrokes()
  );
  const widthHistory = usePropertyScrubHistory("edit stroke width");
  const miterHistory = usePropertyScrubHistory("edit stroke miter");
  const resolved = useAppearanceLayer(layerId);

  if (!resolved) {
    return null;
  }

  const layer = resolved.layer as StrokeLayer;
  const { slot } = resolved;

  return (
    <div className="grid gap-2 pl-[44px]">
      <FieldRow label="Align">
        <StrokeSelect
          ariaLabel="Stroke alignment"
          onChange={(align) => editor.updateAppearanceLayer(slot, { align })}
          options={ALIGN_OPTIONS}
          value={layer.align}
        />
      </FieldRow>
      {layer.align !== "center" && !canAlign ? (
        <p className="text-muted-foreground text-xs">
          Open paths stroke on center.
        </p>
      ) : null}
      <FieldRow label="Width">
        <ScrubSlider
          ariaLabel="Stroke width"
          max={WIDTH_RANGE.max}
          min={WIDTH_RANGE.min}
          onScrubEnd={widthHistory.onScrubEnd}
          onScrubStart={widthHistory.onScrubStart}
          onValueChange={(width) => {
            editor.updateAppearanceLayer(slot, { width });
          }}
          scrubMax={Math.max(WIDTH_SCRUB_RANGE.max, layer.width)}
          scrubMin={WIDTH_SCRUB_RANGE.min}
          value={layer.width}
        />
      </FieldRow>
      <FieldRow label="Cap">
        <StrokeSelect
          ariaLabel="Stroke cap"
          onChange={(cap) => editor.updateAppearanceLayer(slot, { cap })}
          options={CAP_OPTIONS}
          value={layer.cap}
        />
      </FieldRow>
      <FieldRow label="Join">
        <StrokeSelect
          ariaLabel="Stroke join"
          onChange={(join) => editor.updateAppearanceLayer(slot, { join })}
          options={JOIN_OPTIONS}
          value={layer.join}
        />
      </FieldRow>
      {layer.join === "miter" ? (
        <FieldRow label="Miter">
          <ScrubSlider
            ariaLabel="Stroke miter limit"
            max={MITER_RANGE.max}
            min={MITER_RANGE.min}
            onScrubEnd={miterHistory.onScrubEnd}
            onScrubStart={miterHistory.onScrubStart}
            onValueChange={(miterLimit) => {
              editor.updateAppearanceLayer(slot, { miterLimit });
            }}
            value={layer.miterLimit}
          />
        </FieldRow>
      ) : null}
    </div>
  );
};

const StrokeSelect = ({ ariaLabel, onChange, options, value }) => {
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? null;

  return (
    <Select onValueChange={onChange} value={value}>
      <SelectTrigger aria-label={ariaLabel} size="sm">
        <SelectValue>{() => selectedLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
