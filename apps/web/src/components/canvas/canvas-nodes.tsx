import type { CSSProperties } from "react";
import { useEditorPreviewValue } from "../../editor-react/use-editor-preview-value";
import { useEditorValue } from "../../editor-react/use-editor-value";
import { CanvasNode } from "./canvas-node";

const selectNodeIds = (editor, state) =>
  state.nodes
    .filter((node) => node.type === "text")
    .filter((node) => editor.isNodeEffectivelyVisible(node.id))
    .map((node) => node.id);

const EMPTY_PREVIEW = { x: 0, y: 0 };

export const CanvasNodes = () => {
  const nodeIds = useEditorValue(selectNodeIds);
  const selectedNodeIds = useEditorValue((_, state) => state.selectedNodeIds);
  const selectionPreview = useEditorPreviewValue((editor) => {
    return editor.getSelectionPreviewDelta(selectedNodeIds) || EMPTY_PREVIEW;
  });

  const previewStyle = {
    "--canvas-selection-preview-x": `${selectionPreview.x}px`,
    "--canvas-selection-preview-y": `${selectionPreview.y}px`,
  } as CSSProperties;

  return (
    <div className="canvas-node-layer absolute inset-0" style={previewStyle}>
      {nodeIds.map((nodeId) => {
        return <CanvasNode key={nodeId} nodeId={nodeId} />;
      })}
    </div>
  );
};
