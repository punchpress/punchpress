import { useEditorValue } from "../../../editor-react/use-editor-value";

export const usePropertiesPanelState = () => {
  const snapshot = useEditorValue((editor, state) => {
    const selectedNode =
      state.selectedNodeIds.length === 1
        ? editor.getNode(state.selectedNodeIds[0])
        : null;
    const pathEditingInspectorState = editor.getPathEditingInspectorState(
      selectedNode?.id || null
    );

    return {
      bootstrapError: editor.bootstrapError,
      bootstrapState: editor.bootstrapState,
      pathCornerRadiusSummary: pathEditingInspectorState.pathCornerRadiusSummary,
      pathPointCornerMax: pathEditingInspectorState.pathPointCornerMax,
      pathPointCornerRadius: pathEditingInspectorState.pathPointCornerRadius,
      selectedNode,
      selectedPathPoint: pathEditingInspectorState.selectedPathPoint,
      showsPathPointCornerRadius:
        pathEditingInspectorState.showsPathPointCornerRadius,
      selectionPropertiesSnapshot: editor.getSelectionPropertiesSnapshot(
        state.selectedNodeIds
      ),
    };
  });

  return {
    bootstrapError: snapshot.bootstrapError,
    bootstrapState: snapshot.bootstrapState,
    pathPointCornerMax: snapshot.pathPointCornerMax,
    pathPointCornerRadius: snapshot.pathPointCornerRadius,
    selectedNode: snapshot.selectedNode,
    pathCornerRadiusSummary: snapshot.pathCornerRadiusSummary,
    selectedPathPoint: snapshot.selectedPathPoint,
    selectionProperties: snapshot.selectionPropertiesSnapshot.selectionProperties,
    showsPathPointCornerRadius: snapshot.showsPathPointCornerRadius,
  };
};
