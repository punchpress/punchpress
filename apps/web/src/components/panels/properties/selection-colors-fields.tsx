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
      className={withTopBorder ? "border-black/6 border-t" : undefined}
      title="Selection colors"
    >
      {selectionColors.map((selectionColor) => {
        return (
          <SelectionColorRow
            key={selectionColor.id}
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
        stateKey={`selection-color:${selectionColor.id}`}
        value={selectionColor.value}
      />
    </div>
  );
};
