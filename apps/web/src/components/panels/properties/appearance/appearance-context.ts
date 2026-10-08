import type {
  AppearanceList,
  AppearanceSlot,
  FillLayer,
  StrokeLayer,
} from "@punchpress/engine";
import { createContext, useCallback, useContext } from "react";
import { useEditor } from "../../../../editor-react/use-editor";
import { useEditorValue } from "../../../../editor-react/use-editor-value";

interface AppearanceListContextValue {
  list: AppearanceList;
}

// Carries only which list a row belongs to. Rows and fields read their layer
// from the editor, so a value edit re-renders only the controls that show it.
export const AppearanceListContext =
  createContext<AppearanceListContextValue | null>(null);

export const useAppearanceList = () => {
  const value = useContext(AppearanceListContext);

  if (!value) {
    throw new Error("Appearance.Item must render inside Appearance.List.");
  }

  return value.list;
};

// Subscribes to one value of a row's layer. `read` must return a primitive or
// a stored reference; null when the layer is gone.
export const useAppearanceLayerValue = <T>(
  layerId: string,
  read: (layer: FillLayer | StrokeLayer) => T
): T | null => {
  const list = useAppearanceList();

  return useEditorValue((editor, state) => {
    const resolved = editor.getAppearanceLayer(
      list,
      layerId,
      state.selectedNodeIds
    );

    return resolved ? read(resolved.layer) : null;
  });
};

// Controls hold layer ids; commands address layers by index. The id resolves
// to its current slot when the control dispatches, so reorder, remove, and
// undo never retarget a mounted control.
export const useAppearanceLayerSlot = (layerId: string) => {
  const editor = useEditor();
  const list = useAppearanceList();

  return useCallback((): AppearanceSlot | null => {
    return editor.getAppearanceLayer(list, layerId)?.slot ?? null;
  }, [editor, layerId, list]);
};

export const useUpdateAppearanceLayer = (layerId: string) => {
  const editor = useEditor();
  const resolveSlot = useAppearanceLayerSlot(layerId);

  return useCallback(
    (patch: Parameters<typeof editor.updateAppearanceLayer>[1]) => {
      const slot = resolveSlot();

      if (slot) {
        editor.updateAppearanceLayer(slot, patch);
      }
    },
    [editor, resolveSlot]
  );
};
