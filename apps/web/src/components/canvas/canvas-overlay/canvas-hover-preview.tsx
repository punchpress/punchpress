import { isNodeVisible } from "@punchpress/engine";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { getHostRectFromNodeFrame } from "./canvas-overlay-geometry";

const HOVER_OUTSET_PX = 1;

export const CanvasHoverPreview = ({ viewportRevision }) => {
  const editor = useEditor();
  const activeTool = useEditorValue((_, state) => state.activeTool);
  const editingNodeId = useEditorValue((_, state) => state.editingNodeId);
  const pathEditingNodeId = useEditorValue(
    (_, state) => state.pathEditingNodeId
  );
  const spacePressed = useEditorValue((_, state) => state.spacePressed);
  const hoveredNodePreview = useEditorValue((editor, state) => {
    if (
      spacePressed ||
      activeTool !== "pointer" ||
      editingNodeId ||
      pathEditingNodeId ||
      state.isHoveringSuppressed ||
      !state.hoveredNodeId ||
      state.selectedNodeIds.includes(state.hoveredNodeId)
    ) {
      return null;
    }

    const node = editor.getNode(state.hoveredNodeId);
    if (!(node && isNodeVisible(node))) {
      return null;
    }

    return editor.getNodeRenderFrame(node.id);
  });

  const hoveredNodePreviewRect = getHostRectFromNodeFrame(
    editor,
    hoveredNodePreview
  );

  if (!hoveredNodePreviewRect) {
    return null;
  }

  return (
    <div
      className="canvas-hover-preview pointer-events-none absolute"
      data-viewport-revision={viewportRevision}
      style={{
        height: `${hoveredNodePreviewRect.height + HOVER_OUTSET_PX * 2}px`,
        left: `${hoveredNodePreviewRect.left - HOVER_OUTSET_PX}px`,
        top: `${hoveredNodePreviewRect.top - HOVER_OUTSET_PX}px`,
        transform: hoveredNodePreviewRect.transform,
        transformOrigin: "center center",
        width: `${hoveredNodePreviewRect.width + HOVER_OUTSET_PX * 2}px`,
      }}
    />
  );
};
