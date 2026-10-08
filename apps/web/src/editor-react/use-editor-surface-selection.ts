import { useCallback, useRef, useSyncExternalStore } from "react";
import shallow from "zustand/shallow";
import { useEditor } from "./use-editor";

interface SelectionCache {
  revision: number;
  selector: unknown;
  state: unknown;
  value: unknown;
}

// Like `useEditorSurfaceValue`, but re-renders only when the selected value
// changes (one-level shallow equality) instead of on every interaction
// preview. Per-node canvas art uses it so a drag that moves one group does
// not re-render every node in a large document. The selector must read
// everything the component renders from preview state: render bodies that
// read live editor previews directly need `useEditorSurfaceValue`.
export const useEditorSurfaceSelection = (selector) => {
  const editor = useEditor();
  const cache = useRef<SelectionCache | null>(null);
  const subscribe = useCallback(
    (listener: () => void) => {
      const unsubscribePreview = editor.subscribeInteractionPreview(listener);
      const unsubscribeStore = editor.store.subscribe(listener);

      return () => {
        unsubscribePreview();
        unsubscribeStore();
      };
    },
    [editor]
  );
  const getSnapshot = () => {
    const state = editor.getState();
    const revision = editor.getInteractionPreviewRevision();
    const cached = cache.current;

    if (
      cached?.state === state &&
      cached.revision === revision &&
      cached.selector === selector
    ) {
      return cached.value;
    }

    const nextValue = selector(editor, state);
    const value =
      cached && shallow(cached.value, nextValue) ? cached.value : nextValue;

    cache.current = { revision, selector, state, value };

    return value;
  };

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
