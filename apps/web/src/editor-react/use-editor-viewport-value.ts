import { useCallback, useSyncExternalStore } from "react";
import { useEditor } from "./use-editor";

// Live camera reads. The engine publishes every camera change on the viewport
// presentation channel, including mid-gesture changes the store only receives
// when the gesture settles. The selector must return a primitive (or another
// value that stays identical while the camera does), and the component
// re-renders only when that value changes.
export const useEditorViewportValue = <Value>(
  selector: (editor: ReturnType<typeof useEditor>) => Value
) => {
  const editor = useEditor();
  const subscribe = useCallback(
    (listener: () => void) => editor.subscribeViewportPresentation(listener),
    [editor]
  );
  const getSnapshot = () => selector(editor);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
