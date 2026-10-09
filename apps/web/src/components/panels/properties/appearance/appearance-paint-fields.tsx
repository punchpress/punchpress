import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, PlusSignIcon } from "@hugeicons-pro/core-stroke-rounded";
import {
  insertGradientStop,
  type Paint,
  PERF_COUNTERS,
  removeGradientStop,
} from "@punchpress/engine";
import { MAX_GRADIENT_STOPS, parseColor } from "@punchpress/punch-schema";
import { Button } from "@/components/ui/button";
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
import { usePerformanceRenderCounter } from "../../../../performance/use-performance-render-counter";
import { ColorField, FieldRow } from "../field-primitives";
import { NumberField } from "../number-field";
import { usePropertyScrubHistory } from "../use-property-scrub-history";
import {
  useAppearanceLayerSlot,
  useAppearanceLayerValue,
  useAppearanceList,
} from "./appearance-context";
import { formatColorWithOpacity } from "./appearance-paint-swatch";

type LinearGradient = Extract<Paint, { kind: "linear-gradient" }>;

const KIND_OPTIONS = [
  { label: "Solid", value: "solid" },
  { label: "Linear", value: "linear-gradient" },
];

// Paint kind for one layer, plus angle and stops when it is a gradient.
export const AppearancePaintFields = ({ layerId }: { layerId: string }) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesField);
  const editor = useEditor();
  const resolveSlot = useAppearanceLayerSlot(layerId);
  // A stored gradient paint, or just the kind for a solid paint.
  const paint = useAppearanceLayerValue(layerId, (layer) => {
    return layer.paint.kind === "linear-gradient"
      ? layer.paint
      : layer.paint.kind;
  });

  if (paint === null) {
    return null;
  }

  const kind = typeof paint === "string" ? paint : paint.kind;
  const selectedLabel = KIND_OPTIONS.find(
    (option) => option.value === kind
  )?.label;

  return (
    <>
      <FieldRow label="Paint">
        <Select
          onValueChange={(nextKind) => {
            const slot = resolveSlot();

            if (slot) {
              editor.setPaintKind(slot, nextKind as Paint["kind"]);
            }
          }}
          value={kind}
        >
          <SelectTrigger aria-label="Paint kind" size="field">
            <SelectValue>{() => selectedLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {KIND_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>
      {typeof paint === "string" ? null : (
        <GradientFields layerId={layerId} paint={paint} />
      )}
    </>
  );
};

const GradientFields = ({
  layerId,
  paint,
}: {
  layerId: string;
  paint: LinearGradient;
}) => {
  const editor = useEditor();
  const list = useAppearanceList();
  const resolveSlot = useAppearanceLayerSlot(layerId);
  const angleHistory = usePropertyScrubHistory("edit gradient angle");
  const angle = useEditorValue((editor, state) => {
    const slot = editor.getAppearanceLayer(
      list,
      layerId,
      state.selectedNodeIds
    )?.slot;

    return slot ? editor.getGradientAngle(slot, state.selectedNodeIds) : null;
  });

  // Stop edits rewrite the layer's current gradient, read at dispatch.
  const updatePaint = (
    update: (current: LinearGradient) => LinearGradient | null
  ) => {
    const resolved = editor.getAppearanceLayer(list, layerId);
    const current = resolved?.layer.paint;
    const next = current?.kind === "linear-gradient" ? update(current) : null;

    if (resolved && next) {
      editor.updateAppearanceLayer(resolved.slot, { paint: next });
    }
  };
  const setStop = (stopId: string, patch) => {
    updatePaint((current) => ({
      ...current,
      stops: current.stops.map((stop) => {
        return stop.id === stopId ? { ...stop, ...patch } : stop;
      }),
    }));
  };

  return (
    <>
      <FieldRow label="Angle">
        <ScrubSlider
          ariaLabel="Gradient angle"
          formatValue={(value) => `${Math.round(value)}°`}
          max={359}
          min={0}
          onScrubEnd={angleHistory.onScrubEnd}
          onScrubStart={angleHistory.onScrubStart}
          onValueChange={(value) => {
            const slot = resolveSlot();

            if (slot) {
              editor.setGradientAngle(slot, value);
            }
          }}
          size="field"
          value={Math.round(angle ?? 0)}
        />
      </FieldRow>
      {paint.stops.map((stop) => (
        <div
          className="grid grid-cols-[minmax(0,1fr)_3rem_var(--field-icon-button)] items-center gap-1"
          data-stop-id={stop.id}
          data-testid="appearance-gradient-stop"
          key={stop.id}
        >
          <ColorField
            onChange={(value) => {
              const parsed = parseColor(value);

              if (parsed) {
                setStop(stop.id, {
                  color: parsed.color,
                  opacity: parsed.opacity,
                });
              }
            }}
            onInteractionEnd={undefined}
            onInteractionStart={undefined}
            placeholder={undefined}
            stateKey={`appearance-${list}-${layerId}-${stop.id}`}
            value={formatColorWithOpacity(stop.color, stop.opacity)}
          />
          <NumberField
            min={0}
            onValueChange={(percent) => {
              setStop(stop.id, { offset: Math.min(100, percent) / 100 });
            }}
            value={Math.round(stop.offset * 100)}
          />
          <Button
            aria-label="Remove stop"
            disabled={paint.stops.length <= 2}
            onClick={() => {
              updatePaint((current) => removeGradientStop(current, stop.id));
            }}
            size="icon-field"
            variant="ghost"
          >
            <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.8} />
          </Button>
        </div>
      ))}
      <div>
        <Button
          disabled={paint.stops.length >= MAX_GRADIENT_STOPS}
          onClick={() => {
            updatePaint((current) => {
              return insertGradientStop(current, getWidestGapMiddle(current));
            });
          }}
          size="field"
          variant="ghost"
        >
          <HugeiconsIcon icon={PlusSignIcon} size={14} strokeWidth={1.8} />
          Add stop
        </Button>
      </div>
    </>
  );
};

// New stops land in the middle of the widest gap between existing stops.
const getWidestGapMiddle = (paint: LinearGradient) => {
  let best = { size: -1, middle: 0.5 };

  for (let index = 1; index < paint.stops.length; index += 1) {
    const from = paint.stops[index - 1].offset;
    const to = paint.stops[index].offset;

    if (to - from > best.size) {
      best = { middle: (from + to) / 2, size: to - from };
    }
  }

  return best.middle;
};
