import { useEditor } from "../../../editor-react/use-editor";
import { ScrubSlider } from "@/components/ui/scrub-slider";
import { ColorField, FieldRow, Section } from "./field-primitives";
import { NumberField } from "./number-field";

const STROKE_WIDTH_RANGE = { min: 0, max: 200 };

export const AppearanceFields = ({ fill, stroke, strokeWidth }) => {
  const editor = useEditor();

  if (!(fill || stroke || strokeWidth)) {
    return null;
  }

  return (
    <Section className="border-black/6 border-t" title="Fill & Stroke">
      {fill ? (
        <FieldRow label="Fill">
          <ColorField
            onChange={(nextFill) =>
              editor.setSelectionProperty("fill", nextFill)
            }
            placeholder={fill.isMixed ? "Mixed" : undefined}
            value={fill.isMixed ? null : fill.value}
          />
        </FieldRow>
      ) : null}

      {stroke ? (
        <FieldRow label="Stroke">
          <ColorField
            onChange={(nextStroke) =>
              editor.setSelectionProperty("stroke", nextStroke)
            }
            placeholder={stroke.isMixed ? "Mixed" : undefined}
            value={stroke.isMixed ? null : stroke.value}
          />
        </FieldRow>
      ) : null}

      {strokeWidth ? (
        <FieldRow label="Width">
          {strokeWidth.isMixed ? (
            <NumberField
              min={0}
              onValueChange={(nextStrokeWidth) =>
                editor.setSelectionProperty("strokeWidth", nextStrokeWidth)
              }
              placeholder="Mixed"
              value={0}
            />
          ) : (
            <ScrubSlider
              ariaLabel="Stroke width"
              max={STROKE_WIDTH_RANGE.max}
              min={STROKE_WIDTH_RANGE.min}
              onValueChange={(nextStrokeWidth) => {
                editor.setSelectionProperty("strokeWidth", nextStrokeWidth);
              }}
              value={strokeWidth.value ?? 0}
            />
          )}
        </FieldRow>
      ) : null}
    </Section>
  );
};
