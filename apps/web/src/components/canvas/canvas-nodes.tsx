import { useEditorValue } from "../../editor-react/use-editor-value";
import { CanvasRenderItems } from "./canvas-render-layer";
import { useCanvasNodePlacement } from "./placement/use-canvas-node-placement";

// Mounts the engine render tree. Durable placement writes to shells and
// surfaces; a transform preview moves only the gesture's presentation roots.
export const CanvasNodes = () => {
  const tree = useEditorValue((editor) => editor.getRenderTree());

  useCanvasNodePlacement(tree.placedNodeIds);

  return (
    <div className="canvas-node-layer absolute inset-0">
      <CanvasRenderItems items={tree.items} />
    </div>
  );
};
