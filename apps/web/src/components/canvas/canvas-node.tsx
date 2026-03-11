import { cn } from "@/lib/utils";
import { estimateBounds } from "../../editor/shapes/warp-text/warp-engine";
import { useEditor } from "../../editor/use-editor";
import { useEditorValue } from "../../editor/use-editor-value";

export const CanvasNode = ({ nodeId, spacePressed }) => {
  const editor = useEditor();
  const activeTool = useEditorValue((_, state) => state.activeTool);
  const editingNodeId = useEditorValue((_, state) => state.editingNodeId);
  const node = useEditorValue((editor) => editor.getNode(nodeId));
  const geometry = useEditorValue((editor) => editor.getNodeGeometry(nodeId));

  if (!node) {
    return null;
  }

  const bbox = geometry?.bbox || estimateBounds(node);
  const width = Math.max(1, bbox.width);
  const height = Math.max(1, bbox.height);
  const isEditing = editingNodeId === nodeId;

  return (
    <button
      className={cn(
        "canvas-node absolute block cursor-default appearance-none border-0 bg-transparent p-0",
        !geometry?.ready && "opacity-50"
      )}
      data-node-id={node.id}
      onDoubleClick={() => editor.startEditing(node)}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }

        if (spacePressed || activeTool === "hand") {
          return;
        }

        editor.dispatchNodePointerDown({ event, node });
      }}
      onPointerEnter={() => {
        if (spacePressed || activeTool !== "pointer") {
          return;
        }

        editor.setHoveredNode(node.id);
      }}
      onPointerLeave={() => {
        if (editor.hoveredNodeId !== node.id) {
          return;
        }

        editor.setHoveredNode(null);
      }}
      ref={(element) => editor.registerNodeElement(node.id, element)}
      style={{
        height: `${height}px`,
        left: `${node.x + bbox.minX}px`,
        top: `${node.y + bbox.minY}px`,
        transform: `rotate(${node.rotation || 0}deg)`,
        transformOrigin: "center center",
        width: `${width}px`,
      }}
      type="button"
    >
      <svg
        aria-label="Warped text node"
        className="block overflow-visible"
        height={height}
        role="img"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
      >
        <g transform={`translate(${-bbox.minX} ${-bbox.minY})`}>
          {(geometry?.paths || []).map((path) => {
            return (
              <path
                d={path.d}
                fill={isEditing ? "#ff6fae" : node.fill}
                key={path.key || `${path.transform || "shape"}-${path.d}`}
                opacity={isEditing ? 0.24 : 1}
                paintOrder="stroke fill"
                pointerEvents="none"
                stroke={isEditing ? "#ff6fae" : node.stroke}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={node.strokeWidth}
                transform={path.transform || undefined}
              />
            );
          })}
        </g>
      </svg>
    </button>
  );
};
