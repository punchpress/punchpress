import { measurePerf } from "@punchpress/engine";
import { useCallback } from "react";
import { useStore } from "zustand";
import shallow from "zustand/shallow";
import { useEditor } from "./use-editor";

// A stable selector (module-level or memoized) is evaluated once per store
// state, so re-renders driven by other subscriptions do not re-run it.
export const useEditorValue = (selector, perfLabel = null) => {
  const editor = useEditor();
  const selectState = useCallback(
    (state) => {
      if (!perfLabel) {
        return selector(editor, state);
      }

      return measurePerf(perfLabel, () => selector(editor, state));
    },
    [editor, perfLabel, selector]
  );

  return useStore(editor.store, selectState, shallow);
};
