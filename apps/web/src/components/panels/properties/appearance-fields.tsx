import { ScrubSlider } from "@/components/ui/scrub-slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditor } from "../../../editor-react/use-editor";
import { ColorField, FieldRow, Section } from "./field-primitives";
import { NumberField } from "./number-field";

const STROKE_WIDTH_RANGE = { min: 0, max: 200 };
const STROKE_MITER_LIMIT_RANGE = { min: 0, max: 100 };

const SelectField = ({ onChange, options, placeholder, value }) => {
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? null;

  return (
    <Select onValueChange={onChange} value={value}>
      <SelectTrigger size="sm">
        <SelectValue placeholder={placeholder}>
          {() => selectedLabel}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const STROKE_LINE_CAP_OPTIONS = [
  { label: "Butt", value: "butt" },
  { label: "Round", value: "round" },
  { label: "Square", value: "square" },
];

const STROKE_LINE_JOIN_OPTIONS = [
  { label: "Miter", value: "miter" },
  { label: "Round", value: "round" },
  { label: "Bevel", value: "bevel" },
];

export const AppearanceFields = ({
  fill,
  stroke,
  strokeLineCap,
  strokeLineJoin,
  strokeMiterLimit,
  strokeWidth,
  withTopBorder = true,
}) => {
  const showsFillSection = Boolean(fill);
  const showsStrokeSection = Boolean(
    stroke || strokeWidth || strokeLineCap || strokeLineJoin || strokeMiterLimit
  );

  if (!(showsFillSection || showsStrokeSection)) {
    return null;
  }

  return (
    <>
      {showsFillSection ? (
        <FillSection fill={fill} withTopBorder={withTopBorder} />
      ) : null}

      {showsStrokeSection ? (
        <StrokeSection
          showsFillSection={showsFillSection}
          stroke={stroke}
          strokeLineCap={strokeLineCap}
          strokeLineJoin={strokeLineJoin}
          strokeMiterLimit={strokeMiterLimit}
          strokeWidth={strokeWidth}
          withTopBorder={withTopBorder}
        />
      ) : null}
    </>
  );
};

const FillSection = ({ fill, withTopBorder }) => {
  const editor = useEditor();

  return (
    <Section
      className={withTopBorder ? "border-black/6 border-t" : undefined}
      title="Fill"
    >
      <FieldRow label="Color">
        <ColorField
          onChange={(nextFill) => editor.setSelectionProperty("fill", nextFill)}
          placeholder={fill?.isMixed ? "Mixed" : undefined}
          stateKey="fill"
          value={fill?.isMixed ? null : fill?.value}
        />
      </FieldRow>
    </Section>
  );
};

const StrokeSection = ({
  showsFillSection,
  stroke,
  strokeLineCap,
  strokeLineJoin,
  strokeMiterLimit,
  strokeWidth,
  withTopBorder,
}) => {
  const sectionClassName =
    withTopBorder || showsFillSection ? "border-black/6 border-t" : undefined;

  return (
    <Section className={sectionClassName} title="Stroke">
      <StrokeColorField stroke={stroke} />
      <StrokeWidthField strokeWidth={strokeWidth} />
      <StrokeCapField strokeLineCap={strokeLineCap} />
      <StrokeJoinField strokeLineJoin={strokeLineJoin} />
      <StrokeMiterField strokeMiterLimit={strokeMiterLimit} />
    </Section>
  );
};

const StrokeColorField = ({ stroke }) => {
  const editor = useEditor();

  if (!stroke) {
    return null;
  }

  return (
    <FieldRow label="Color">
      <ColorField
        onChange={(nextStroke) =>
          editor.setSelectionProperty("stroke", nextStroke)
        }
        placeholder={stroke.isMixed ? "Mixed" : undefined}
        stateKey="stroke"
        value={stroke.isMixed ? null : stroke.value}
      />
    </FieldRow>
  );
};

const StrokeWidthField = ({ strokeWidth }) => {
  const editor = useEditor();

  if (!strokeWidth) {
    return null;
  }

  return (
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
  );
};

const StrokeCapField = ({ strokeLineCap }) => {
  const editor = useEditor();

  if (!strokeLineCap) {
    return null;
  }

  return (
    <FieldRow label="Cap">
      <SelectField
        onChange={(nextStrokeLineCap) =>
          editor.setSelectionProperty("strokeLineCap", nextStrokeLineCap)
        }
        options={STROKE_LINE_CAP_OPTIONS}
        placeholder={strokeLineCap.isMixed ? "Mixed" : undefined}
        value={strokeLineCap.isMixed ? undefined : strokeLineCap.value}
      />
    </FieldRow>
  );
};

const StrokeJoinField = ({ strokeLineJoin }) => {
  const editor = useEditor();

  if (!strokeLineJoin) {
    return null;
  }

  return (
    <FieldRow label="Join">
      <SelectField
        onChange={(nextStrokeLineJoin) =>
          editor.setSelectionProperty("strokeLineJoin", nextStrokeLineJoin)
        }
        options={STROKE_LINE_JOIN_OPTIONS}
        placeholder={strokeLineJoin.isMixed ? "Mixed" : undefined}
        value={strokeLineJoin.isMixed ? undefined : strokeLineJoin.value}
      />
    </FieldRow>
  );
};

const StrokeMiterField = ({ strokeMiterLimit }) => {
  const editor = useEditor();

  if (!strokeMiterLimit) {
    return null;
  }

  return (
    <FieldRow label="Miter">
      {strokeMiterLimit.isMixed ? (
        <NumberField
          min={STROKE_MITER_LIMIT_RANGE.min}
          onValueChange={(nextStrokeMiterLimit) =>
            editor.setSelectionProperty(
              "strokeMiterLimit",
              nextStrokeMiterLimit
            )
          }
          placeholder="Mixed"
          value={0}
        />
      ) : (
        <ScrubSlider
          ariaLabel="Stroke miter limit"
          max={STROKE_MITER_LIMIT_RANGE.max}
          min={STROKE_MITER_LIMIT_RANGE.min}
          onValueChange={(nextStrokeMiterLimit) => {
            editor.setSelectionProperty(
              "strokeMiterLimit",
              nextStrokeMiterLimit
            );
          }}
          value={strokeMiterLimit.value ?? 0}
        />
      )}
    </FieldRow>
  );
};
