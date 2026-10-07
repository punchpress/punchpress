import type { RenderItem } from "@punchpress/engine";
import { memo } from "react";
import { useEditorValue } from "../../editor-react/use-editor-value";
import { CanvasNode } from "./canvas-node/canvas-node";
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
        <CanvasRenderLayer
          items={item.children}
          key={item.nodeId}
          nodeId={item.nodeId}
          opacity={item.opacity}
        />
      );
    }

    return <CanvasNode key={item.nodeId} nodeId={item.nodeId} />;
  });
};

// A zero-size, unpositioned-content wrapper: its descendants keep stage
// coordinates, and CSS opacity below 1 isolates the whole subtree so the
// layer's opacity applies once to its flattened content. It carries no
// node markers, so hit testing and selection never target it.
const CanvasRenderLayer = memo(
  ({
    items,
    nodeId,
    opacity,
  }: {
    items: RenderItem[];
    nodeId: string;
    opacity: number;
  }) => {
    return (
      <div
        className="pointer-events-none absolute top-0 left-0 h-0 w-0"
        data-render-layer={nodeId}
        style={opacity < 1 ? { opacity } : undefined}
      >
        <CanvasRenderItems items={items} />
      </div>
    );
  }
);
