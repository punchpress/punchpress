import {
  canRoundPathPoint as canEditorRoundPathPoint,
  getPathCornerRadiusStableMax as getEditorPathCornerRadiusStableMax,
  getPathCornerRadiusSummary as getEditorPathCornerRadiusSummary,
  getPathPointCornerControl as getEditorPathPointCornerControl,
  getPathPointCornerRadius as getEditorPathPointCornerRadius,
} from "../../document/path/path-corner-actions";

export const getPathEditingInspectorState = (editor, nodeId) => {
  const selectedPathPoint =
    nodeId &&
    editor.pathEditingNodeId === nodeId &&
    editor.pathEditingPoints.length === 1 &&
    editor.pathEditingPoint
      ? editor.pathEditingPoint
      : null;
  const showsPathPointCornerRadius = Boolean(
    nodeId &&
      selectedPathPoint &&
      canEditorRoundPathPoint(editor, nodeId, selectedPathPoint)
  );

  return {
    pathCornerRadiusSummary:
      nodeId && !showsPathPointCornerRadius
        ? getEditorPathCornerRadiusSummary(editor, nodeId)
        : null,
    pathCornerRadiusStableMax:
      nodeId && !showsPathPointCornerRadius
        ? getEditorPathCornerRadiusStableMax(editor, nodeId)
        : 0,
    pathPointCornerMax:
      nodeId && selectedPathPoint
        ? (getEditorPathPointCornerControl(editor, nodeId, selectedPathPoint)
            ?.maxRadius ?? 0)
        : 0,
    pathPointCornerRadius:
      nodeId && selectedPathPoint
        ? getEditorPathPointCornerRadius(editor, nodeId, selectedPathPoint)
        : 0,
    selectedPathPoint,
    showsPathPointCornerRadius,
  };
};
