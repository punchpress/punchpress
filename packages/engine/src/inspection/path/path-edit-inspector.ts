import {
  canRoundPathPoint as canEditorRoundPathPoint,
  getPathCornerRadiusStableMax as getEditorPathCornerRadiusStableMax,
  getPathCornerRadiusSummary as getEditorPathCornerRadiusSummary,
  getPathPointCornerControl as getEditorPathPointCornerControl,
  getPathPointCornerRadius as getEditorPathPointCornerRadius,
} from "../../document/path/path-corner-actions";

type PathEditingInspectorState = ReturnType<typeof buildInspectorState>;

interface CachedInspectorState {
  inputs: unknown[];
  state: PathEditingInspectorState;
}

// Corner inspection derives contours and summaries. Every inspector read in
// one store update shares one result until the inspected node or the
// path-editing point selection changes.
const cacheByEditor = new WeakMap<object, CachedInspectorState>();

export const getPathEditingInspectorState = (
  editor,
  nodeId: string | null
): PathEditingInspectorState => {
  const inputs = [
    nodeId,
    nodeId ? editor.getNode(nodeId) : null,
    editor.pathEditingNodeId,
    editor.pathEditingPoint,
    editor.pathEditingPoints,
  ];
  const cached = cacheByEditor.get(editor);

  if (cached?.inputs.every((input, index) => input === inputs[index])) {
    return cached.state;
  }

  const state = buildInspectorState(editor, nodeId);

  cacheByEditor.set(editor, { inputs, state });

  return state;
};

const buildInspectorState = (editor, nodeId: string | null) => {
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
  const pathCornerRadiusSummary =
    nodeId && !showsPathPointCornerRadius
      ? getEditorPathCornerRadiusSummary(editor, nodeId)
      : null;

  return {
    pathCornerRadiusSummary,
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
