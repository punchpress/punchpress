import { isNodeVisible } from "../../../editor/shapes/warp-text/model";
import { useEditor } from "../../../editor/use-editor";
import { useEditorValue } from "../../../editor/use-editor-value";
import { getHostRectFromNodeFrame } from "./canvas-overlay-geometry";

export const CanvasHoverPreview = ({ viewportRevision }) => {
  const editor = useEditor();
  const activeTool = useEditorValue((_, state) => state.activeTool);
  const editingNodeId = useEditorValue((_, state) => state.editingNodeId);
  const spacePressed = useEditorValue((_, state) => state.spacePressed);
  const hoveredNodePreview = useEditorValue((editor, state) => {
    if (
      spacePressed ||
      activeTool !== "pointer" ||
      editingNodeId ||
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

    return editor.getNodeFrame(node.id);
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
        height: `${hoveredNodePreviewRect.height}px`,
        left: `${hoveredNodePreviewRect.left}px`,
        top: `${hoveredNodePreviewRect.top}px`,
        transform: hoveredNodePreviewRect.transform,
        transformOrigin: "center center",
        width: `${hoveredNodePreviewRect.width}px`,
      }}
    />
  );
};
