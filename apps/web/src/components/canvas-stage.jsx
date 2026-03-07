import { useState } from "react";
import { ARTBOARD_HEIGHT, ARTBOARD_WIDTH } from "../editor/constants";
import { format } from "../editor/math-utils";
import { inflateBounds } from "../editor/warp-engine";
import {
  buildCornerHandles,
  SELECTION_CORNER_HANDLE_HIT_SIZE,
  SelectionOutline,
} from "./selection-outline";

const HANDLE_CURSORS = {
  tl: "nwse-resize",
  br: "nwse-resize",
  tr: "nesw-resize",
  bl: "nesw-resize",
};

export const CanvasStage = ({
  activeTool,
  editingNodeId,
  inlineEditor,
  geometryById,
  handleCanvasBackgroundPointerDown,
  handleNodePointerDown,
  hoveredGeometry,
  hoveredNode,
  hoveredNodeId,
  nodes,
  pan,
  selectedGeometry,
  selectedNode,
  selectedNodeId,
  setHoveredNodeId,
  spacePressed,
  workspaceRef,
  zoom,
  onResizeHandlePointerDown,
  onTextToolCanvasPointerDown,
  onTextToolNodePointerDown,
  onWheel,
  onWorkspacePointerDown,
}) => {
  const [hoveredHandleId, setHoveredHandleId] = useState(null);

  const getCanvasPoint = (event) => {
    const workspaceElement = workspaceRef.current;
    if (!workspaceElement) {
      return null;
    }

    const workspaceRect = workspaceElement.getBoundingClientRect();
    return {
      x: (event.clientX - workspaceRect.left - pan.x) / zoom,
      y: (event.clientY - workspaceRect.top - pan.y) / zoom,
    };
  };

  const getNodeAtPoint = (point) => {
    if (!point) {
      return null;
    }

    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const node = nodes[index];
      const geometry = geometryById.get(node.id);
      if (!geometry) {
        continue;
      }

      const hitBounds = inflateBounds(geometry.bbox, 26);
      const minX = node.x + hitBounds.minX;
      const maxX = node.x + hitBounds.maxX;
      const minY = node.y + hitBounds.minY;
      const maxY = node.y + hitBounds.maxY;

      if (
        point.x >= minX &&
        point.x <= maxX &&
        point.y >= minY &&
        point.y <= maxY
      ) {
        return node;
      }
    }

    return null;
  };

  const getResizeHandleAtPoint = (point) => {
    if (!(point && selectedNode && selectedGeometry)) {
      return null;
    }

    const handles = buildCornerHandles(selectedGeometry.bbox);
    const halfSize = SELECTION_CORNER_HANDLE_HIT_SIZE / 2;

    for (const handle of handles) {
      const centerX = selectedNode.x + handle.x;
      const centerY = selectedNode.y + handle.y;
      const minX = centerX - halfSize;
      const maxX = centerX + halfSize;
      const minY = centerY - halfSize;
      const maxY = centerY + halfSize;

      if (
        point.x >= minX &&
        point.x <= maxX &&
        point.y >= minY &&
        point.y <= maxY
      ) {
        return handle.id;
      }
    }

    return null;
  };

  return (
    <section
      className={`workspace ${spacePressed ? "space-pan" : ""} tool-${activeTool}`}
      onPointerDown={onWorkspacePointerDown}
      onWheel={onWheel}
      ref={workspaceRef}
    >
      <div
        className="stage"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        <svg
          aria-label="Warped text editor artboard"
          height={ARTBOARD_HEIGHT}
          onPointerDown={(event) => {
            const canvasPoint = getCanvasPoint(event);
            if (activeTool === "hand") {
              return;
            }

            if (activeTool === "text") {
              const targetNode = getNodeAtPoint(canvasPoint);
              if (targetNode) {
                onTextToolNodePointerDown(event, targetNode);
                return;
              }

              onTextToolCanvasPointerDown(event, canvasPoint);
              return;
            }

            const resizeHandleId = getResizeHandleAtPoint(canvasPoint);
            if (resizeHandleId && selectedNode && selectedGeometry) {
              onResizeHandlePointerDown(
                event,
                selectedNode,
                selectedGeometry,
                resizeHandleId,
                canvasPoint
              );
              return;
            }

            const targetNode = getNodeAtPoint(canvasPoint);
            if (targetNode) {
              handleNodePointerDown(event, targetNode);
              return;
            }
            handleCanvasBackgroundPointerDown(event);
          }}
          onPointerLeave={() => {
            setHoveredNodeId(null);
            setHoveredHandleId(null);
          }}
          onPointerMove={(event) => {
            if (activeTool !== "pointer") {
              setHoveredNodeId(null);
              setHoveredHandleId(null);
              return;
            }

            const canvasPoint = getCanvasPoint(event);
            const handleId = getResizeHandleAtPoint(canvasPoint);
            setHoveredHandleId(handleId);

            if (!handleId) {
              const targetNode = getNodeAtPoint(canvasPoint);
              setHoveredNodeId(targetNode ? targetNode.id : null);
            }
          }}
          role="application"
          style={
            hoveredHandleId
              ? { cursor: HANDLE_CURSORS[hoveredHandleId] }
              : undefined
          }
          viewBox={`0 0 ${ARTBOARD_WIDTH} ${ARTBOARD_HEIGHT}`}
          width={ARTBOARD_WIDTH}
        >
          <title>Warped text editor artboard</title>
          <rect
            fill="#2d2d2d"
            height={ARTBOARD_HEIGHT}
            width={ARTBOARD_WIDTH}
          />

          {nodes.map((node) => {
            const geometry = geometryById.get(node.id);
            if (!geometry) {
              return null;
            }

            const hitBounds = inflateBounds(geometry.bbox, 26);
            const isEditing = editingNodeId === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${format(node.x)} ${format(node.y)})`}
              >
                {geometry.paths.map((path, index) => {
                  return (
                    <path
                      d={path.d}
                      fill={isEditing ? "#ff6fae" : node.fill}
                      key={`${node.id}-${index}`}
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

                <rect
                  className={`node-hit-target tool-${activeTool}`}
                  fill="transparent"
                  height={format(Math.max(hitBounds.height, 2))}
                  width={format(Math.max(hitBounds.width, 2))}
                  x={format(hitBounds.minX)}
                  y={format(hitBounds.minY)}
                />
              </g>
            );
          })}

          {hoveredNodeId &&
            hoveredNodeId !== selectedNodeId &&
            hoveredGeometry &&
            hoveredNode && (
              <SelectionOutline
                geometry={hoveredGeometry}
                node={hoveredNode}
                withHandles={false}
              />
            )}

          {selectedNode && selectedGeometry && (
            <SelectionOutline
              geometry={selectedGeometry}
              node={selectedNode}
              withHandles={activeTool === "pointer"}
            />
          )}
        </svg>

        {inlineEditor}
      </div>
    </section>
  );
};
