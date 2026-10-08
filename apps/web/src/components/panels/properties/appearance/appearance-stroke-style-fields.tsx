import { PERF_COUNTERS, type StrokeLayer } from "@punchpress/engine";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditorValue } from "../../../../editor-react/use-editor-value";
import { usePerformanceRenderCounter } from "../../../../performance/use-performance-render-counter";
import { FieldRow } from "../field-primitives";
import {
  useAppearanceLayerValue,
  useUpdateAppearanceLayer,
} from "./appearance-context";

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

export const StrokeAlignField = ({ layerId }: { layerId: string }) => {
  const align = useStrokeStyle(layerId, "align");

  return align === null ? null : (
    <>
      <StrokeStyleSelect
        ariaLabel="Stroke alignment"
        label="Align"
        layerId={layerId}
        options={ALIGN_OPTIONS}
        property="align"
        value={align}
      />
      {align === "center" ? null : <StrokeAlignHint />}
    </>
  );
};

export const StrokeCapField = ({ layerId }: { layerId: string }) => {
  const cap = useStrokeStyle(layerId, "cap");

  return cap === null ? null : (
    <StrokeStyleSelect
      ariaLabel="Stroke cap"
      label="Cap"
      layerId={layerId}
      options={CAP_OPTIONS}
      property="cap"
      value={cap}
    />
  );
};

export const StrokeJoinField = ({ layerId }: { layerId: string }) => {
  const join = useStrokeStyle(layerId, "join");

  return join === null ? null : (
    <StrokeStyleSelect
      ariaLabel="Stroke join"
      label="Join"
      layerId={layerId}
      options={JOIN_OPTIONS}
      property="join"
      value={join}
    />
  );
};

// Aligned strokes fall back to center on open-only paths. Mounted only for
// aligned strokes, so center strokes never run the check.
const StrokeAlignHint = () => {
  const canAlign = useEditorValue((editor, state) => {
    return editor.canAlignStrokes(state.selectedNodeIds);
  });

  return canAlign ? null : (
    <p className="text-muted-foreground text-xs">
      Open paths stroke on center.
    </p>
  );
};

type StrokeStyleProperty = "align" | "cap" | "join";

const useStrokeStyle = (layerId: string, property: StrokeStyleProperty) => {
  return useAppearanceLayerValue(layerId, (layer) => {
    return (layer as StrokeLayer)[property] as string;
  });
};

const StrokeStyleSelect = ({
  ariaLabel,
  label,
  layerId,
  options,
  property,
  value,
}: {
  ariaLabel: string;
  label: string;
  layerId: string;
  options: { label: string; value: string }[];
  property: StrokeStyleProperty;
  value: string;
}) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesField);
  const updateLayer = useUpdateAppearanceLayer(layerId);
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? null;

  return (
    <FieldRow label={label}>
      <Select
        onValueChange={(nextValue) => updateLayer({ [property]: nextValue })}
        value={value}
      >
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
    </FieldRow>
  );
};
