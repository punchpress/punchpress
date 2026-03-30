import { isNodeVisible } from "@punchpress/engine";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorValue } from "../../../editor-react/use-editor-value";

const HOVER_OUTSET_PX = 1;

export const CanvasHoverPreview = () => {
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

  if (!hoveredNodePreview) {
    return null;
  }

  return (
    <div
      className="canvas-hover-preview pointer-events-none absolute"
      style={{
        height: `${hoveredNodePreview.bounds.height + HOVER_OUTSET_PX * 2}px`,
        transform: hoveredNodePreview.transform
          ? `translate3d(${hoveredNodePreview.bounds.minX - HOVER_OUTSET_PX}px, ${hoveredNodePreview.bounds.minY - HOVER_OUTSET_PX}px, 0) ${hoveredNodePreview.transform}`
          : `translate3d(${hoveredNodePreview.bounds.minX - HOVER_OUTSET_PX}px, ${hoveredNodePreview.bounds.minY - HOVER_OUTSET_PX}px, 0)`,
        transformOrigin: "center center",
        width: `${hoveredNodePreview.bounds.width + HOVER_OUTSET_PX * 2}px`,
      }}
    />
  );
};
