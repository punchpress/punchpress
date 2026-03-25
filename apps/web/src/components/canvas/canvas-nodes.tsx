import { useEditorValue } from "../../editor-react/use-editor-value";
import { CanvasNode } from "./canvas-node";
import { useCanvasNodePlacement } from "./use-canvas-node-placement";

const selectNodeIds = (editor, state) =>
  state.nodes
    .filter((node) => node.type !== "group")
    .filter((node) => editor.isNodeEffectivelyVisible(node.id))
    .map((node) => node.id);

export const CanvasNodes = () => {
  const nodeIds = useEditorValue(selectNodeIds);

  useCanvasNodePlacement(nodeIds);

  return (
    <div className="canvas-node-layer absolute inset-0">
      {nodeIds.map((nodeId) => {
        return <CanvasNode key={nodeId} nodeId={nodeId} />;
      })}
    </div>
  );
};
