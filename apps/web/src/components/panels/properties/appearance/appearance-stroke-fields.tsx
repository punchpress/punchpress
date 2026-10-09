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

// Alignment, cap, join, and (for miter joins) miter limit of one stroke
// layer: the settings a stroke row tucks away at denser layouts. Each control
// subscribes to its own value; each scrub is one undo step.
export const AppearanceStrokeStyleFields = ({
  layerId,
}: {
  layerId: string;
}) => {
  return (
    <>
      <StrokeAlignField layerId={layerId} />
      <StrokeCapField layerId={layerId} />
      <StrokeJoinField layerId={layerId} />
      <StrokeMiterField layerId={layerId} />
    </>
  );
};

// Stroke width stays on the row; a width scrub re-renders only this field.
export const AppearanceStrokeWidthField = ({
  layerId,
}: {
  layerId: string;
}) => {
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
        size="field"
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
        size="field"
        value={miterLimit}
      />
    </FieldRow>
  );
};
