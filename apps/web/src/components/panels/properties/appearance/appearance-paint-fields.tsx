import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, PlusSignIcon } from "@hugeicons-pro/core-stroke-rounded";
import {
  insertGradientStop,
  type Paint,
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
import { ColorField, FieldRow } from "../field-primitives";
import { NumberField } from "../number-field";
import { usePropertyScrubHistory } from "../use-property-scrub-history";
import { useAppearanceLayer, useAppearanceList } from "./appearance-context";
import { formatColorWithOpacity } from "./appearance-paint-swatch";

type LinearGradient = Extract<Paint, { kind: "linear-gradient" }>;

const KIND_OPTIONS = [
  { label: "Solid", value: "solid" },
  { label: "Linear", value: "linear-gradient" },
];

// Paint kind for one layer, plus angle and stops when it is a gradient.
export const AppearancePaintFields = ({ layerId }: { layerId: string }) => {
  const editor = useEditor();
  const resolved = useAppearanceLayer(layerId);

  if (!resolved) {
    return null;
  }

  const { layer, slot } = resolved;
  const selectedLabel = KIND_OPTIONS.find(
    (option) => option.value === layer.paint.kind
  )?.label;

  return (
    <div className="grid gap-2 pl-[44px]">
      <FieldRow label="Paint">
        <Select
          onValueChange={(kind) => {
            editor.setPaintKind(slot, kind as Paint["kind"]);
          }}
          value={layer.paint.kind}
        >
          <SelectTrigger aria-label="Paint kind" size="sm">
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
      {layer.paint.kind === "linear-gradient" ? (
        <GradientFields layerId={layerId} paint={layer.paint} />
      ) : null}
    </div>
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
  const resolved = useAppearanceLayer(layerId);
  const angleHistory = usePropertyScrubHistory("edit gradient angle");
  const slot = resolved?.slot;
  const angle = useEditorValue((editor) => {
    return slot ? editor.getGradientAngle(slot) : null;
  });

  if (!slot) {
    return null;
  }

  const setPaint = (next: LinearGradient | null) => {
    if (next) {
      editor.updateAppearanceLayer(slot, { paint: next });
    }
  };
  const setStop = (stopId: string, patch) => {
    setPaint({
      ...paint,
      stops: paint.stops.map((stop) => {
        return stop.id === stopId ? { ...stop, ...patch } : stop;
      }),
    });
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
          onValueChange={(value) => editor.setGradientAngle(slot, value)}
          value={Math.round(angle ?? 0)}
        />
      </FieldRow>
      {paint.stops.map((stop) => (
        <div
          className="grid grid-cols-[minmax(0,1fr)_64px_24px] items-center gap-2"
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
            onClick={() => setPaint(removeGradientStop(paint, stop.id))}
            size="icon-xs"
            variant="ghost"
          >
            <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.8} />
          </Button>
        </div>
      ))}
      <div>
        <Button
          disabled={paint.stops.length >= MAX_GRADIENT_STOPS}
          onClick={() =>
            setPaint(insertGradientStop(paint, getWidestGapMiddle(paint)))
          }
          size="xs"
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
