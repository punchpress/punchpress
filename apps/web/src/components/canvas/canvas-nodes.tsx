import type { RenderItem } from "@punchpress/engine";
import { useEditorValue } from "../../editor-react/use-editor-value";
import { CanvasNode } from "./canvas-node/canvas-node";
import { CanvasRenderLayer } from "./canvas-render-layer";
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

const CanvasRenderItems = ({ items }: { items: RenderItem[] }) => {
  return items.map((item) => {
    if (item.kind === "layer") {
      return (
        <CanvasRenderLayer key={item.nodeId} layer={item}>
          <CanvasRenderItems items={item.children} />
        </CanvasRenderLayer>
      );
    }

    return <CanvasNode key={item.nodeId} nodeId={item.nodeId} />;
  });
};
