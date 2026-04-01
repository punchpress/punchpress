import { useEditorValue } from "../../../editor-react/use-editor-value";

export const usePropertiesPanelState = () => {
  const snapshot = useEditorValue((editor, state) => {
    const selectedNode =
      state.selectedNodeIds.length === 1
        ? editor.getNode(state.selectedNodeIds[0])
        : null;
    const isSelectedPathPointActive = Boolean(
      selectedNode?.id &&
        state.pathEditingNodeId === selectedNode.id &&
        state.pathEditingPoints.length === 1 &&
        state.pathEditingPoint
    );
    const selectedPathPoint = isSelectedPathPointActive
      ? state.pathEditingPoint
      : null;
    const selectedPathPointCanRound = Boolean(
      selectedNode?.id &&
        selectedPathPoint &&
        editor.canRoundPathPoint(selectedNode.id, selectedPathPoint)
    );

    return {
      bootstrapError: editor.bootstrapError,
      bootstrapState: editor.bootstrapState,
      pathCornerRadiusSummary:
        selectedNode?.id &&
        !selectedPathPointCanRound
          ? editor.getPathCornerRadiusSummary(selectedNode.id)
          : null,
      pathPointCornerRadius:
        selectedNode?.id && selectedPathPoint
          ? editor.getPathPointCornerRadius(selectedNode.id, selectedPathPoint)
          : 0,
      pathPointCornerMax:
        selectedNode?.id && selectedPathPoint
          ? (editor.getPathPointCornerControl(selectedNode.id, selectedPathPoint)
              ?.maxRadius ?? 0)
          : 0,
      selectedNode,
      selectedPathPoint,
      showsPathPointCornerRadius:
        selectedPathPointCanRound,
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
