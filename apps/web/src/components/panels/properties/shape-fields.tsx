import {
  ToggleGroup,
  Toggle as ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { ScrubSlider } from "@/components/ui/scrub-slider";
import { useEditor } from "../../../editor-react/use-editor";
import { FieldRow, PairedRow, Section } from "./field-primitives";

const SHAPE_SIZE_RANGE = { min: 1, max: 5000 };
const CORNER_RADIUS_RANGE = { min: 0, max: 1000 };

const SHAPE_OPTIONS = [
  { label: "Poly", value: "polygon" },
  { label: "Oval", value: "ellipse" },
  { label: "Star", value: "star" },
];

export const ShapeFields = ({ cornerRadius, height, node, shape, width }) => {
  const editor = useEditor();

  if (!(node && shape && width && height)) {
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
          value={shape.value ? [shape.value] : []}
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
          value={width.value ?? node.width}
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
          value={height.value ?? node.height}
        />
      </FieldRow>

      {cornerRadius ? (
        <FieldRow label="Corners">
          <ScrubSlider
            ariaLabel="Polygon corner radius"
            max={CORNER_RADIUS_RANGE.max}
            min={CORNER_RADIUS_RANGE.min}
            onValueChange={(nextCornerRadius) => {
              editor.setSelectionProperty("cornerRadius", nextCornerRadius);
            }}
            value={cornerRadius.value ?? node.cornerRadius ?? 0}
          />
        </FieldRow>
      ) : null}
    </Section>
  );
};
