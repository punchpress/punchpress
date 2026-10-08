import { PERF_COUNTERS } from "@punchpress/engine";
import { useRef } from "react";
import { ScrubSlider } from "@/components/ui/scrub-slider";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { usePerformanceRenderCounter } from "../../../performance/use-performance-render-counter";
import { useCornerSliderPresentation } from "./corner-slider-presentation";
import { FieldRow, Section } from "./field-primitives";

const CORNER_RADIUS_RANGE = { min: 0 };
const CORNER_RADIUS_KEYBOARD_STEP = 1;
const CORNER_RADIUS_STEP = 0.01;
const formatCornerRadiusDisplay = (value: number) => {
  return Math.round(value).toString();
};

// Corner radius across the path-editing target's eligible corners.
export const PathCornerFields = ({ nodeId }: { nodeId: string }) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesSection);
  const editor = useEditor();
  const scrubSourceNodeRef = useRef(null);
  const corner = useEditorValue((editor) => {
    const inspector = editor.getPathEditingInspectorState(nodeId);
    const summary = inspector.pathCornerRadiusSummary;

    return {
      available: Boolean(summary),
      isMixed: Boolean(summary?.isMixed),
      max: (summary?.max as number | undefined) ?? 0,
      stableMax: inspector.pathCornerRadiusStableMax,
      value: (summary?.value as number | undefined) ?? 0,
    };
  });
  const {
    displayValue,
    preserveDisplayValueWhileDragging,
    valueBadge,
    visualMax,
  } = useCornerSliderPresentation({
    currentValue: corner.value,
    formatValue: formatCornerRadiusDisplay,
    isMixed: corner.isMixed,
    max: corner.stableMax || corner.max,
  });

  if (!corner.available) {
    return null;
  }

  return (
    <Section title="Path">
      <FieldRow label="Corners">
        <ScrubSlider
          ariaLabel="Path corner radius"
          displayValue={displayValue}
          formatValue={formatCornerRadiusDisplay}
          keyboardStep={CORNER_RADIUS_KEYBOARD_STEP}
          max={visualMax || corner.max}
          min={CORNER_RADIUS_RANGE.min}
          onScrubEnd={() => {
            scrubSourceNodeRef.current = null;
          }}
          onScrubStart={() => {
            scrubSourceNodeRef.current = editor.getNode(nodeId);
          }}
          onValueChange={(nextCornerRadius) => {
            editor.setPathCornerRadius(
              nextCornerRadius,
              nodeId,
              scrubSourceNodeRef.current
            );
          }}
          preserveDisplayValueWhileDragging={preserveDisplayValueWhileDragging}
          step={CORNER_RADIUS_STEP}
          value={corner.value}
          valueBadge={valueBadge}
        />
      </FieldRow>
    </Section>
  );
};
