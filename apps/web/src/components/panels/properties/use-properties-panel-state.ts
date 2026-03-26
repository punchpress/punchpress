import { useEditorValue } from "../../../editor-react/use-editor-value";

export const usePropertiesPanelState = () => {
  const snapshot = useEditorValue((editor, state) => {
    return {
      bootstrapError: editor.bootstrapError,
      bootstrapState: editor.bootstrapState,
      selectionPropertiesSnapshot: editor.getSelectionPropertiesSnapshot(
        state.selectedNodeIds
      ),
    };
  });

  return {
    bootstrapError: snapshot.bootstrapError,
    bootstrapState: snapshot.bootstrapState,
    selectionProperties: snapshot.selectionPropertiesSnapshot.selectionProperties,
  };
};
