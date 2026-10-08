import { useEditorValue } from "../../editor-react/use-editor-value";
import { CanvasRenderItems } from "./canvas-render-layer";
import { useCanvasNodePlacement } from "./use-canvas-node-placement";

// Mounts the engine render tree. Groups and artboards are compositing layers
// that never move; placement writes only to shell and surface nodes.
export const CanvasNodes = () => {
  const tree = useEditorValue((editor) => editor.getRenderTree());

  useCanvasNodePlacement(tree.placedNodeIds);

  return (
    <div className="canvas-node-layer absolute inset-0">
      <CanvasRenderItems items={tree.items} />
    </div>
  );
};
