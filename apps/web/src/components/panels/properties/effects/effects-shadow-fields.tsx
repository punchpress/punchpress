import { PERF_COUNTERS } from "@punchpress/engine";
import { ScrubSlider } from "@/components/ui/scrub-slider";
import { usePerformanceRenderCounter } from "../../../../performance/use-performance-render-counter";
import { FieldRow } from "../field-primitives";
import { usePropertyScrubHistory } from "../use-property-scrub-history";
import { useEffectValue, useUpdateEffect } from "./use-effect-controls";

const OFFSET_RANGE = { max: 10_000, min: -10_000 };
const OFFSET_SCRUB_RANGE = { max: 50, min: -50 };
const BLUR_RANGE = { max: 1000, min: 0 };
const BLUR_SCRUB_RANGE = { max: 50, min: 0 };

const SHADOW_FIELDS = {
  blur: {
    ariaLabel: "Shadow blur",
    history: "edit shadow blur",
    label: "Blur",
    range: BLUR_RANGE,
    scrubRange: BLUR_SCRUB_RANGE,
  },
  x: {
    ariaLabel: "Shadow X",
    history: "edit shadow x",
    label: "X",
    range: OFFSET_RANGE,
    scrubRange: OFFSET_SCRUB_RANGE,
  },
  y: {
    ariaLabel: "Shadow Y",
    history: "edit shadow y",
    label: "Y",
    range: OFFSET_RANGE,
    scrubRange: OFFSET_SCRUB_RANGE,
  },
};

type ShadowProperty = keyof typeof SHADOW_FIELDS;

// Offset and blur of one drop shadow, in the owner's local units. Each field
// subscribes to its own value, so a blur scrub re-renders only the blur
// field. Each scrub is one undo step.
export const EffectsShadowFields = ({ effectId }: { effectId: string }) => {
  return (
    <div className="grid gap-2 pl-[44px]">
      <ShadowField effectId={effectId} property="x" />
      <ShadowField effectId={effectId} property="y" />
      <ShadowField effectId={effectId} property="blur" />
    </div>
  );
};

const ShadowField = ({
  effectId,
  property,
}: {
  effectId: string;
  property: ShadowProperty;
}) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesField);
  const field = SHADOW_FIELDS[property];
  const history = usePropertyScrubHistory(field.history);
  const updateEffect = useUpdateEffect(effectId);
  const value = useEffectValue(effectId, (effect) => effect[property]);

  if (value === null) {
    return null;
  }

  return (
    <FieldRow label={field.label}>
      <ScrubSlider
        ariaLabel={field.ariaLabel}
        max={field.range.max}
        min={field.range.min}
        onScrubEnd={history.onScrubEnd}
        onScrubStart={history.onScrubStart}
        onValueChange={(next) => updateEffect({ [property]: next })}
        scrubMax={Math.max(field.scrubRange.max, value)}
        scrubMin={Math.min(field.scrubRange.min, value)}
        value={value}
      />
    </FieldRow>
  );
};
