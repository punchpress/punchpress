import { useCallback, useMemo, useSyncExternalStore } from "react";

// Untitled file tabs stay dirty until saved; the scratchpad autosaves.
const getTabIsDirty = (tab) => {
  if (tab.kind === "scratchpad") {
    return false;
  }

  return tab.editor.isDirty || !tab.fileHandle;
};

// Re-renders only when a tab's dirty state flips, not on every document edit.
// Every file tab is observed so async work finishing after a tab switch still
// updates its dirty state.
export const useDirtyTabIds = (tabs) => {
  const subscribe = useCallback(
    (listener) => {
      const unsubscribers = tabs
        .filter((tab) => tab.kind === "file")
        .map((tab) => tab.editor.subscribeDirtyState(listener));

      return () => {
        for (const unsubscribe of unsubscribers) {
          unsubscribe();
        }
      };
    },
    [tabs]
  );
  const getSnapshot = () => {
    return tabs
      .filter(getTabIsDirty)
      .map((tab) => tab.id)
      .join("|");
  };

  const dirtyTabKey = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return useMemo(() => new Set(dirtyTabKey.split("|")), [dirtyTabKey]);
};
