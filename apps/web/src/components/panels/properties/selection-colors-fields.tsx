import { PERF_COUNTERS } from "@punchpress/engine";
import { useCallback, useEffect, useRef } from "react";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { usePerformanceRenderCounter } from "../../../performance/use-performance-render-counter";
import { ColorField, Section } from "./field-primitives";

// The section re-renders when the set of swatches changes; each row
// subscribes to its own color.
export const SelectionColorsFields = ({ withTopBorder = true }) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesSection);
  const fieldIds = useEditorValue((editor, state) => {
    return editor
      .getSelectionColors(state.selectedNodeIds)
      .map((selectionColor) => selectionColor.fieldId as string);
  });

  if (fieldIds.length === 0) {
    return null;
  }

  return (
    <Section
      className={withTopBorder ? "border-black/4 border-t" : undefined}
      title="Selection colors"
    >
      {fieldIds.map((fieldId) => {
        return <SelectionColorRow fieldId={fieldId} key={fieldId} />;
      })}
    </Section>
  );
};

const SelectionColorRow = ({ fieldId }: { fieldId: string }) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesRow);
  const editor = useEditor();
  const selectionColor = useEditorValue((editor, state) => {
    const color = editor
      .getSelectionColors(state.selectedNodeIds)
      .find((candidate) => candidate.fieldId === fieldId);

    return {
      id: (color?.id as string | undefined) ?? null,
      value: (color?.value as string | undefined) ?? null,
    };
  });
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

  if (!selectionColor.id) {
    return null;
  }

  return (
    <div className="min-w-0">
      <ColorField
        onChange={handleChange}
        onInteractionEnd={finishPreviewSession}
        onInteractionStart={handleInteractionStart}
        stateKey={`selection-color:${fieldId}`}
        value={selectionColor.value}
      />
    </div>
  );
};
