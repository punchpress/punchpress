import { cn } from "@/lib/utils";
import { estimateBounds } from "../editor/warp-engine";

export const CanvasNode = ({
  geometry,
  isEditing,
  node,
  onDoubleClick,
  onPointerDown,
  registerElement,
}) => {
  const bbox = geometry?.bbox || estimateBounds(node);
  const width = Math.max(1, bbox.width);
  const height = Math.max(1, bbox.height);

  return (
    <button
      className={cn(
        "canvas-node absolute block cursor-default appearance-none border-0 bg-transparent p-0",
        !geometry?.ready && "opacity-50"
      )}
      data-node-id={node.id}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      ref={(element) => registerElement(node.id, element)}
      style={{
        height: `${height}px`,
        left: `${node.x + bbox.minX}px`,
        top: `${node.y + bbox.minY}px`,
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
