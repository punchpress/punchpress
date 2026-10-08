import { PERF_COUNTERS, type StrokeLayer } from "@punchpress/engine";
import { ScrubSlider } from "@/components/ui/scrub-slider";
import { usePerformanceRenderCounter } from "../../../../performance/use-performance-render-counter";
import { FieldRow } from "../field-primitives";
import { usePropertyScrubHistory } from "../use-property-scrub-history";
import {
  useAppearanceLayerValue,
  useUpdateAppearanceLayer,
} from "./appearance-context";
import {
  StrokeAlignField,
  StrokeCapField,
  StrokeJoinField,
} from "./appearance-stroke-style-fields";

const WIDTH_RANGE = { max: 1000, min: 0 };
const WIDTH_SCRUB_RANGE = { max: 50, min: 0 };
const MITER_RANGE = { max: 100, min: 1 };

// Alignment, width, cap, join, and (for miter joins) miter limit of one
// stroke layer. Each control subscribes to its own value, so a width scrub
// re-renders only the width field. Each scrub is one undo step.
export const AppearanceStrokeFields = ({ layerId }: { layerId: string }) => {
  return (
    <div className="grid gap-2 pl-[44px]">
      <StrokeAlignField layerId={layerId} />
      <StrokeWidthField layerId={layerId} />
      <StrokeCapField layerId={layerId} />
      <StrokeJoinField layerId={layerId} />
      <StrokeMiterField layerId={layerId} />
    </div>
  );
};

const StrokeWidthField = ({ layerId }: { layerId: string }) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesField);
  const history = usePropertyScrubHistory("edit stroke width");
  const updateLayer = useUpdateAppearanceLayer(layerId);
  const width = useAppearanceLayerValue(layerId, (layer) => {
    return (layer as StrokeLayer).width;
  });

  if (width === null) {
    return null;
  }

  return (
    <FieldRow label="Width">
      <ScrubSlider
        ariaLabel="Stroke width"
        max={WIDTH_RANGE.max}
        min={WIDTH_RANGE.min}
        onScrubEnd={history.onScrubEnd}
        onScrubStart={history.onScrubStart}
        onValueChange={(nextWidth) => updateLayer({ width: nextWidth })}
        scrubMax={Math.max(WIDTH_SCRUB_RANGE.max, width)}
        scrubMin={WIDTH_SCRUB_RANGE.min}
        value={width}
      />
    </FieldRow>
  );
};

// Shown for miter joins only; subscribes to the join and the limit.
const StrokeMiterField = ({ layerId }: { layerId: string }) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesField);
  const history = usePropertyScrubHistory("edit stroke miter");
  const updateLayer = useUpdateAppearanceLayer(layerId);
  const miterLimit = useAppearanceLayerValue(layerId, (layer) => {
    const stroke = layer as StrokeLayer;

    return stroke.join === "miter" ? stroke.miterLimit : null;
  });

  if (miterLimit === null) {
    return null;
  }

  return (
    <FieldRow label="Miter">
      <ScrubSlider
        ariaLabel="Stroke miter limit"
        max={MITER_RANGE.max}
        min={MITER_RANGE.min}
        onScrubEnd={history.onScrubEnd}
        onScrubStart={history.onScrubStart}
        onValueChange={(nextLimit) => updateLayer({ miterLimit: nextLimit })}
        value={miterLimit}
      />
    </FieldRow>
  );
};
