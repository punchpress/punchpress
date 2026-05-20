import { useEditor } from "../../../editor-react/use-editor";
import { ColorField, Section } from "./field-primitives";

export const SelectionColorsFields = ({
  selectionColors,
  withTopBorder = true,
}) => {
  if (selectionColors.length === 0) {
    return null;
  }

  return (
    <Section
      className={withTopBorder ? "border-black/4 border-t" : undefined}
      title="Selection colors"
    >
      {selectionColors.map((selectionColor) => {
        return (
          <SelectionColorRow
            key={selectionColor.fieldId}
            selectionColor={selectionColor}
          />
        );
      })}
    </Section>
  );
};

const SelectionColorRow = ({ selectionColor }) => {
  const editor = useEditor();

  return (
    <div className="min-w-0">
      <ColorField
        onChange={(nextValue) =>
          editor.setSelectionColor(selectionColor.id, nextValue)
        }
        stateKey={`selection-color:${selectionColor.fieldId}`}
        value={selectionColor.value}
      />
    </div>
  );
};
