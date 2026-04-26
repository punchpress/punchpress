import { isNodeVisible } from "@punchpress/engine";
import { useEditor } from "../../../../editor-react/use-editor";
import { useEditorValue } from "../../../../editor-react/use-editor-value";
import { getHostRectFromNodeFrame } from "../canvas-overlay-geometry";

export const CanvasShapeIndicator = ({ viewportRevision }) => {
  const editor = useEditor();
  const editingNodeId = useEditorValue((_, state) => state.editingNodeId);
  const visibleSelectedNodeIds = useEditorValue((editor, state) => {
    return state.selectedNodeIds.filter((nodeId) => {
      return isNodeVisible(editor.getNode(nodeId));
    });
  });
  const editingFrame = useEditorValue((editor) => editor.editingFrame);

  const editingSelectionRect =
    editingNodeId && visibleSelectedNodeIds.length === 1
      ? getHostRectFromNodeFrame(editor, editingFrame)
      : null;

  if (!editingSelectionRect) {
    return null;
  }

  return (
    <div
      className="canvas-shape-indicator pointer-events-none absolute"
      data-viewport-revision={viewportRevision}
      style={{
        height: `${editingSelectionRect.height}px`,
        left: `${editingSelectionRect.left}px`,
        top: `${editingSelectionRect.top}px`,
        transform: editingSelectionRect.transform,
        transformOrigin: "center center",
        width: `${editingSelectionRect.width}px`,
      }}
    />
  );
};
