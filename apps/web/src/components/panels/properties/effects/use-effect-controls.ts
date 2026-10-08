import type { Effect } from "@punchpress/engine";
import { useCallback } from "react";
import { useEditor } from "../../../../editor-react/use-editor";
import { useEditorValue } from "../../../../editor-react/use-editor-value";

// Subscribes to one value of a row's effect. `read` must return a primitive or
// a stored reference; null when the effect is gone.
export const useEffectValue = <T>(
  effectId: string,
  read: (effect: Effect) => T
): T | null => {
  return useEditorValue((editor, state) => {
    const resolved = editor.getEffect(effectId, state.selectedNodeIds);

    return resolved ? read(resolved.effect) : null;
  });
};

// Controls hold effect ids; commands address effects by index. The id resolves
// to its current index when the control dispatches, so reorder, remove, and
// undo never retarget a mounted control.
export const useEffectIndex = (effectId: string) => {
  const editor = useEditor();

  return useCallback(() => {
    return editor.getEffect(effectId)?.index ?? null;
  }, [editor, effectId]);
};

export const useUpdateEffect = (effectId: string) => {
  const editor = useEditor();
  const resolveIndex = useEffectIndex(effectId);

  return useCallback(
    (patch: Parameters<typeof editor.updateEffect>[1]) => {
      const index = resolveIndex();

      if (index !== null) {
        editor.updateEffect(index, patch);
      }
    },
    [editor, resolveIndex]
  );
};
