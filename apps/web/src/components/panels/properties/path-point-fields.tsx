import { PERF_COUNTERS } from "@punchpress/engine";
import { useRef } from "react";
import { ScrubSlider } from "@/components/ui/scrub-slider";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { usePerformanceRenderCounter } from "../../../performance/use-performance-render-counter";
import { FieldRow, Section } from "./field-primitives";

const CORNER_RADIUS_RANGE = { min: 0 };
const CORNER_RADIUS_KEYBOARD_STEP = 1;
const CORNER_RADIUS_STEP = 0.01;
const formatCornerRadiusDisplay = (value: number) => {
  return Math.round(value).toString();
};

// Corner radius of the one selected path point on the path-editing target.
export const PathPointFields = ({ nodeId }: { nodeId: string }) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesSection);
  const editor = useEditor();
  const scrubSourceNodeRef = useRef(null);
  const corner = useEditorValue((editor) => {
    const inspector = editor.getPathEditingInspectorState(nodeId);

    return {
      max: inspector.pathPointCornerMax,
      point: inspector.selectedPathPoint,
      radius: inspector.pathPointCornerRadius,
    };
  });

  if (!corner.point) {
    return null;
  }

  return (
    <Section title="Point">
      <FieldRow label="Corner">
        <ScrubSlider
          ariaLabel="Point corner radius"
          formatValue={formatCornerRadiusDisplay}
          keyboardStep={CORNER_RADIUS_KEYBOARD_STEP}
          max={corner.max}
          min={CORNER_RADIUS_RANGE.min}
          onScrubEnd={() => {
            scrubSourceNodeRef.current = null;
          }}
          onScrubStart={() => {
            scrubSourceNodeRef.current = editor.getNode(nodeId);
          }}
          onValueChange={(nextCornerRadius) => {
            editor.setPathPointCornerRadius(
              nextCornerRadius,
              nodeId,
              corner.point,
              scrubSourceNodeRef.current
            );
          }}
          step={CORNER_RADIUS_STEP}
          value={corner.radius ?? 0}
        />
      </FieldRow>
    </Section>
  );
};
