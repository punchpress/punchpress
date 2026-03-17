import { useEditorValue } from "../../editor-react/use-editor-value";
import { CanvasNode } from "./canvas-node";

const selectNodeIds = (editor, state) =>
  state.nodes
    .filter((node) => node.type === "text")
    .filter((node) => editor.isNodeEffectivelyVisible(node.id))
    .map((node) => node.id);

export const CanvasNodes = () => {
  const nodeIds = useEditorValue(selectNodeIds);

  return nodeIds.map((nodeId) => {
    return <CanvasNode key={nodeId} nodeId={nodeId} />;
  });
};
