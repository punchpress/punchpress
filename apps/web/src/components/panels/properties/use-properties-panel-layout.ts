import { useEditorValue } from "../../../editor-react/use-editor-value";

const NODE_SECTION_TYPES = new Set(["artboard", "image", "shape", "text"]);

// Which sections the panel shows, as primitives. Value edits leave every
// field here unchanged, so the panel root re-renders only when the selection,
// the inspected node, the path-editing mode, or the raster tool changes; each
// section subscribes to its own values.
export const usePropertiesPanelLayout = () => {
  return useEditorValue((editor, state) => {
    const inspection = editor.getSelectionInspection(state.selectedNodeIds);
    const selectedNodeId =
      state.selectedNodeIds.length === 1 ? state.selectedNodeIds[0] : null;
    // Path fields inspect the path-editing target, which can be a vector's
    // child path rather than the selected node.
    const pathNodeId = selectedNodeId
      ? editor.getPathEditingTargetNodeId(selectedNodeId)
      : null;
    const pathNodeType = pathNodeId ? editor.getNode(pathNodeId)?.type : null;
    const pathInspector = editor.getPathEditingInspectorState(selectedNodeId);
    const showsPathPointCorner = Boolean(
      pathNodeId && pathInspector.showsPathPointCornerRadius
    );
    const showsPathCorners = Boolean(
      pathNodeType === "path" &&
        !showsPathPointCorner &&
        pathInspector.pathCornerRadiusSummary
    );
    const rasterTool = editor.getBrushToolSettings(state.activeTool)
      ? (state.activeTool as string)
      : null;

    return {
      bootstrapError: editor.bootstrapError as string | null,
      bootstrapState: editor.bootstrapState as string,
      canDelete: inspection.canDelete,
      hasAppearance: inspection.hasAppearance || inspection.hasOpacity,
      // Sections above appearance; selection colors draw a divider after them.
      hasLeadingFields: Boolean(
        NODE_SECTION_TYPES.has(inspection.nodeType ?? "") ||
          rasterTool ||
          showsPathPointCorner ||
          showsPathCorners
      ),
      hasSelectionColors: inspection.hasSelectionColors,
      nodeId: inspection.nodeId,
      nodeType: inspection.nodeType,
      pathNodeId,
      rasterTool,
      selectionKind: inspection.selectionKind,
      showsPathCorners,
      showsPathPointCorner,
    };
  });
};
