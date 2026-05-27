import { useCallback, useEffect, useRef } from "react";
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
  const previewSessionRef = useRef(null);
  const latestValueRef = useRef(selectionColor.value);

  const finishPreviewSession = useCallback(() => {
    const session = previewSessionRef.current;

    if (!session) {
      return;
    }

    previewSessionRef.current = null;

    if (latestValueRef.current === session.baseValue) {
      editor.cancelSelectionColorChange();
      return;
    }

    editor.commitSelectionColorChange(session, latestValueRef.current);
  }, [editor]);

  useEffect(() => {
    latestValueRef.current = selectionColor.value;
  }, [selectionColor.value]);

  useEffect(() => {
    return () => {
      finishPreviewSession();
    };
  }, [finishPreviewSession]);

  const handleInteractionStart = useCallback(() => {
    latestValueRef.current = selectionColor.value;
    previewSessionRef.current = editor.beginSelectionColorChange(
      selectionColor.id
    );
  }, [editor, selectionColor.id, selectionColor.value]);

  const handleChange = useCallback(
    (nextValue) => {
      latestValueRef.current = nextValue;

      if (previewSessionRef.current) {
        editor.updateSelectionColorChange(previewSessionRef.current, nextValue);
        return;
      }

      editor.setSelectionColor(selectionColor.id, nextValue);
    },
    [editor, selectionColor.id]
  );

  return (
    <div className="min-w-0">
      <ColorField
        onChange={handleChange}
        onInteractionEnd={finishPreviewSession}
        onInteractionStart={handleInteractionStart}
        stateKey={`selection-color:${selectionColor.fieldId}`}
        value={selectionColor.value}
      />
    </div>
  );
};
