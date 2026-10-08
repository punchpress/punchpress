import { PERF_COUNTERS } from "@punchpress/engine";
import { ScrubSlider } from "@/components/ui/scrub-slider";
import {
  ToggleGroup,
  Toggle as ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { usePerformanceRenderCounter } from "../../../performance/use-performance-render-counter";
import { useCornerSliderPresentation } from "./corner-slider-presentation";
import { FieldRow, Section } from "./field-primitives";

const SHAPE_SIZE_RANGE = { min: 1, max: 5000 };
const CORNER_RADIUS_RANGE = { min: 0 };
const CORNER_RADIUS_KEYBOARD_STEP = 1;
const CORNER_RADIUS_STEP = 0.01;
const formatCornerRadiusDisplay = (value: number) => {
  return Math.round(value).toString();
};

const SHAPE_OPTIONS = [
  { label: "Poly", value: "polygon" },
  { label: "Oval", value: "ellipse" },
  { label: "Star", value: "star" },
];

export const ShapeFields = ({ nodeId }: { nodeId: string }) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesSection);
  const editor = useEditor();
  const fields = useShapeFieldValues(nodeId);
  const {
    displayValue,
    preserveDisplayValueWhileDragging,
    valueBadge,
    visualMax,
  } = useCornerSliderPresentation({
    currentValue: fields.cornerValue,
    formatValue: formatCornerRadiusDisplay,
    isMixed: fields.cornerIsMixed,
    max: fields.cornerMax,
  });

  if (!fields.available) {
    return null;
  }

  return (
    <Section title="Shape">
      <FieldRow label="Type">
        <ToggleGroup
          className="grid grid-cols-3 gap-1.5"
          onValueChange={(values) => {
            const nextShape = values[0];
            if (!nextShape) {
              return;
            }

            editor.setSelectionProperty("shape", nextShape);
            editor.setNextShapeKind(nextShape);
          }}
          value={fields.shape ? [fields.shape] : []}
        >
          {SHAPE_OPTIONS.map((option) => {
            return (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </FieldRow>

      <FieldRow label="Width">
        <ScrubSlider
          ariaLabel="Shape width"
          max={SHAPE_SIZE_RANGE.max}
          min={SHAPE_SIZE_RANGE.min}
          onValueChange={(nextWidth) => {
            editor.setSelectionProperty("width", nextWidth);
          }}
          value={fields.width}
        />
      </FieldRow>

      <FieldRow label="Height">
        <ScrubSlider
          ariaLabel="Shape height"
          max={SHAPE_SIZE_RANGE.max}
          min={SHAPE_SIZE_RANGE.min}
          onValueChange={(nextHeight) => {
            editor.setSelectionProperty("height", nextHeight);
          }}
          value={fields.height}
        />
      </FieldRow>

      {fields.hasCorners ? (
        <FieldRow label="Corners">
          <ScrubSlider
            ariaLabel="Shape corner radius"
            displayValue={displayValue}
            formatValue={formatCornerRadiusDisplay}
            keyboardStep={CORNER_RADIUS_KEYBOARD_STEP}
            max={visualMax || fields.cornerMax}
            min={CORNER_RADIUS_RANGE.min}
            onValueChange={(nextCornerRadius) => {
              editor.setSelectionProperty("cornerRadius", nextCornerRadius);
            }}
            preserveDisplayValueWhileDragging={
              preserveDisplayValueWhileDragging
            }
            step={CORNER_RADIUS_STEP}
            value={fields.cornerValue}
            valueBadge={valueBadge}
          />
        </FieldRow>
      ) : null}
    </Section>
  );
};

// Primitive shape values, so appearance or effect edits on the shape leave
// this section alone.
const useShapeFieldValues = (nodeId: string) => {
  return useEditorValue((editor, state) => {
    const node = editor.getNode(nodeId);
    const read = (propertyId: string) => {
      return editor.getSelectionProperty(propertyId, state.selectedNodeIds);
    };
    const shape = read("shape");
    const width = read("width");
    const height = read("height");
    const cornerRadius = read("cornerRadius");
    const cornerSummary = editor.getPathCornerRadiusSummary(nodeId);

    return {
      available: Boolean(node && shape && width && height),
      cornerIsMixed: Boolean(cornerSummary?.isMixed || cornerRadius?.isMixed),
      cornerMax: (cornerSummary?.max as number | undefined) ?? 0,
      cornerValue:
        (cornerSummary?.value as number | undefined) ??
        cornerRadius?.value ??
        node?.cornerRadius ??
        0,
      hasCorners: Boolean(cornerRadius && cornerSummary),
      height: height?.value ?? node?.height,
      shape: (shape?.value as string | null | undefined) ?? null,
      width: width?.value ?? node?.width,
    };
  });
};
