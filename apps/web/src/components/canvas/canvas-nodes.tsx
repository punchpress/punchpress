import { useEditorValue } from "../../editor/use-editor-value";
import { CanvasNode } from "./canvas-node";

const selectNodeIds = (_, state) => state.nodes.map((node) => node.id);

export const CanvasNodes = ({ spacePressed }) => {
  const nodeIds = useEditorValue(selectNodeIds);

  return nodeIds.map((nodeId) => {
    return (
      <CanvasNode key={nodeId} nodeId={nodeId} spacePressed={spacePressed} />
    );
  });
};
