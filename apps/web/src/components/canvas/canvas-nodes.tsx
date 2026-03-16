import { isNodeVisible } from "@punchpress/engine";
import { useEditorValue } from "../../editor-react/use-editor-value";
import { CanvasNode } from "./canvas-node";

const selectNodeIds = (_, state) =>
  state.nodes.filter(isNodeVisible).map((node) => node.id);

export const CanvasNodes = () => {
  const nodeIds = useEditorValue(selectNodeIds);

  return nodeIds.map((nodeId) => {
    return <CanvasNode key={nodeId} nodeId={nodeId} />;
  });
};
