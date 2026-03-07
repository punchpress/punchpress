import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import InfiniteViewer from "react-infinite-viewer";
import Moveable from "react-moveable";
import Selecto from "react-selecto";
import { cn } from "@/lib/utils";
import { MAX_ZOOM, MIN_ZOOM } from "../editor/constants";
import { isInputElement } from "../editor/dom-utils";
import { clamp, round } from "../editor/math-utils";
import { useSpacePan } from "../hooks/use-space-pan";
import { CanvasNode } from "./canvas-node";
import { DesignerFloatingToolbar, DesignerFrame } from "./designer/designer";
import { EditorToolbar } from "./editor-toolbar";

const INITIAL_ZOOM = 1;

const getResizeAnchor = (targetRect, direction) => {
  const [horizontalDirection, verticalDirection] = direction;

  return {
    bboxX: horizontalDirection >= 0 ? "minX" : "maxX",
    bboxY: verticalDirection >= 0 ? "minY" : "maxY",
    clientX: horizontalDirection >= 0 ? targetRect.left : targetRect.right,
    clientY: verticalDirection >= 0 ? targetRect.top : targetRect.bottom,
  };
};

const getResizePointer = (event) => {
  const inputEvent = event.inputEvent;
  if (
    inputEvent &&
    "clientX" in inputEvent &&
    "clientY" in inputEvent &&
    typeof inputEvent.clientX === "number" &&
    typeof inputEvent.clientY === "number"
  ) {
    return {
      x: inputEvent.clientX,
      y: inputEvent.clientY,
    };
  }

  if (typeof event.clientX === "number" && typeof event.clientY === "number") {
    return {
      x: event.clientX,
      y: event.clientY,
    };
  }

  return null;
};

const getCenterPoint = (viewer, host, zoom) => {
  if (!(viewer && host)) {
    return { x: 0, y: 0 };
  }

  const rect = host.getBoundingClientRect();

  return {
    x: viewer.getScrollLeft() + rect.width / (2 * zoom),
    y: viewer.getScrollTop() + rect.height / (2 * zoom),
  };
};

const getCanvasPoint = (viewer, host, clientX, clientY, zoom) => {
  if (!(viewer && host)) {
    return { x: 0, y: 0 };
  }

  const rect = host.getBoundingClientRect();

  return {
    x: viewer.getScrollLeft() + (clientX - rect.left) / zoom,
    y: viewer.getScrollTop() + (clientY - rect.top) / zoom,
  };
};

export const Canvas = ({
  activeTool,
  editingNodeId,
  geometryById,
  inlineEditor,
  nodes,
  onAddText,
  onClearSelection,
  onFinalizeEditing,
  onSelectNode,
  onSelectTool,
  onStartEditing,
  onUpdateNode,
  selectedNodeId,
}) => {
  const [spacePressed, setSpacePressed] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [viewport, setViewport] = useState({ zoom: INITIAL_ZOOM });

  const viewerRef = useRef(null);
  const hostRef = useRef(null);
  const nodeElementsRef = useRef(new Map());
  const spacePressedRef = useRef(false);
  const moveableRef = useRef(null);

  useSpacePan(setSpacePressed, spacePressedRef);

  const selectedNode = useMemo(() => {
    return nodes.find((node) => node.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  useEffect(() => {
    setSelectedTarget(
      selectedNodeId
        ? nodeElementsRef.current.get(selectedNodeId) || null
        : null
    );
  }, [selectedNodeId]);

  useEffect(() => {
    if (!(selectedTarget && moveableRef.current)) {
      return;
    }

    moveableRef.current.updateRect?.();
  }, [selectedTarget]);

  const registerElement = useCallback(
    (nodeId, element) => {
      if (element) {
        nodeElementsRef.current.set(nodeId, element);
      } else {
        nodeElementsRef.current.delete(nodeId);
      }

      if (nodeId === selectedNodeId) {
        setSelectedTarget(element || null);
      }
    },
    [selectedNodeId]
  );

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      viewer.setTo?.({
        x: 0,
        y: 0,
        zoom: INITIAL_ZOOM,
      });
      setViewport({ zoom: INITIAL_ZOOM });
    });

    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const handleScroll = useCallback((event) => {
    setViewport({
      zoom: event.zoomX,
    });
    moveableRef.current?.updateRect?.();
  }, []);

  const handleZoomIn = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    viewer.setZoom(clamp(viewport.zoom * 1.18, MIN_ZOOM, MAX_ZOOM));
  }, [viewport.zoom]);

  const handleZoomOut = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    viewer.setZoom(clamp(viewport.zoom / 1.18, MIN_ZOOM, MAX_ZOOM));
  }, [viewport.zoom]);

  const handleAddTextAtCenter = useCallback(() => {
    const point = getCenterPoint(
      viewerRef.current,
      hostRef.current,
      viewport.zoom
    );
    onAddText({
      x: round(point.x, 2),
      y: round(point.y, 2),
    });
  }, [onAddText, viewport.zoom]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (isInputElement(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "t") {
        event.preventDefault();
        handleAddTextAtCenter();
        return;
      }

      if (key === "v") {
        event.preventDefault();
        onSelectTool("pointer");
        return;
      }

      if (key === "h") {
        event.preventDefault();
        onSelectTool("hand");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleAddTextAtCenter, onSelectTool]);

  return (
    <DesignerFrame>
      <div
        className="relative flex min-h-0 flex-1"
        data-panning={
          spacePressed || activeTool === "hand" ? "true" : undefined
        }
        ref={hostRef}
      >
        <InfiniteViewer
          className={cn(
            "canvas-surface h-full w-full bg-[var(--designer-bg)]",
            (spacePressed || activeTool === "hand") && "cursor-grab"
          )}
          margin={2400}
          onScroll={handleScroll}
          ref={viewerRef}
          threshold={0}
          useAutoZoom
          useMouseDrag={spacePressed || activeTool === "hand"}
          useWheelScroll
          wheelPinchKey="meta"
          zoom={viewport.zoom}
          zoomRange={[MIN_ZOOM, MAX_ZOOM]}
        >
          <div
            className="relative h-full w-full overflow-visible border-0 bg-transparent shadow-none"
            onPointerDown={(event) => {
              if (event.target !== event.currentTarget) {
                return;
              }

              if (editingNodeId) {
                onFinalizeEditing();
                return;
              }

              if (activeTool === "text") {
                const point = getCanvasPoint(
                  viewerRef.current,
                  hostRef.current,
                  event.clientX,
                  event.clientY,
                  viewport.zoom
                );

                onAddText({
                  x: round(point.x, 2),
                  y: round(point.y, 2),
                });
                return;
              }

              onClearSelection();
            }}
          >
            {nodes.map((node) => {
              const geometry = geometryById.get(node.id);

              return (
                <CanvasNode
                  geometry={geometry}
                  isEditing={editingNodeId === node.id}
                  isSelected={selectedNodeId === node.id}
                  key={node.id}
                  node={node}
                  onDoubleClick={() => onStartEditing(node)}
                  onPointerDown={(event) => {
                    if (event.button !== 0) {
                      return;
                    }

                    if (spacePressed || activeTool === "hand") {
                      return;
                    }

                    if (editingNodeId) {
                      onFinalizeEditing();
                      return;
                    }

                    if (activeTool === "text") {
                      onStartEditing(node);
                      return;
                    }

                    onSelectNode(node.id);
                  }}
                  registerElement={registerElement}
                />
              );
            })}

            {inlineEditor}
          </div>
        </InfiniteViewer>

        <DesignerFloatingToolbar>
          <EditorToolbar
            activeTool={activeTool}
            onSelectTool={onSelectTool}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            zoom={viewport.zoom}
          />
        </DesignerFloatingToolbar>

        <Selecto
          boundContainer={hostRef.current}
          className="canvas-selecto"
          container={hostRef.current}
          dragContainer={hostRef.current}
          hitRate={10}
          onDragStart={(event) => {
            if (
              spacePressed ||
              event.inputEvent.button !== 0 ||
              activeTool !== "pointer" ||
              isInputElement(event.inputEvent.target) ||
              moveableRef.current?.isMoveableElement?.(event.inputEvent.target)
            ) {
              event.stop();
            }
          }}
          onSelectEnd={(event) => {
            const nextTarget = event.selected.at(-1);
            onSelectNode(nextTarget?.dataset.nodeId || null);
          }}
          rootContainer={hostRef.current}
          selectableTargets={[".canvas-node"]}
          selectByClick={false}
          selectFromInside={false}
        />

        <Moveable
          className="canvas-moveable"
          container={hostRef.current}
          draggable={Boolean(selectedTarget && !editingNodeId)}
          flushSync={flushSync}
          hideDefaultLines={false}
          keepRatio
          onDrag={(event) => {
            if (!selectedNode) {
              return;
            }

            onUpdateNode(selectedNode.id, {
              x: round(event.datas.startX + event.beforeTranslate[0], 2),
              y: round(event.datas.startY + event.beforeTranslate[1], 2),
            });
          }}
          onDragStart={(event) => {
            event.datas.startX = selectedNode?.x || 0;
            event.datas.startY = selectedNode?.y || 0;
          }}
          onResize={(event) => {
            if (
              !(
                selectedNode &&
                event.datas.baseBBox &&
                Number.isFinite(event.datas.anchorClientX) &&
                Number.isFinite(event.datas.anchorClientY) &&
                Number.isFinite(event.datas.startDistance)
              )
            ) {
              return;
            }

            const pointer = getResizePointer(event);
            if (!pointer) {
              return;
            }

            const resizeScale = clamp(
              Math.hypot(
                pointer.x - event.datas.anchorClientX,
                pointer.y - event.datas.anchorClientY
              ) / event.datas.startDistance,
              0.001,
              20
            );

            onUpdateNode(selectedNode.id, {
              fontSize: round(
                Math.max(1, event.datas.baseFontSize * resizeScale),
                2
              ),
              strokeWidth: round(
                Math.max(0, event.datas.baseStrokeWidth * resizeScale),
                2
              ),
              tracking: round(event.datas.baseTracking * resizeScale, 2),
              x: round(
                event.datas.baseX +
                  event.datas.baseBBox[event.datas.anchorBBoxX] -
                  event.datas.baseBBox[event.datas.anchorBBoxX] * resizeScale,
                2
              ),
              y: round(
                event.datas.baseY +
                  event.datas.baseBBox[event.datas.anchorBBoxY] -
                  event.datas.baseBBox[event.datas.anchorBBoxY] * resizeScale,
                2
              ),
            });
          }}
          onResizeStart={(event) => {
            if (!selectedNode) {
              return;
            }

            const bbox = geometryById.get(selectedNode.id)?.bbox;
            if (!bbox) {
              return;
            }

            const targetRect = selectedTarget?.getBoundingClientRect();
            const pointer = getResizePointer(event);
            if (!(targetRect && pointer)) {
              return;
            }

            const anchor = getResizeAnchor(targetRect, event.direction);

            event.datas.baseBBox = bbox;
            event.datas.anchorBBoxX = anchor.bboxX;
            event.datas.anchorBBoxY = anchor.bboxY;
            event.datas.anchorClientX = anchor.clientX;
            event.datas.anchorClientY = anchor.clientY;
            event.datas.baseFontSize = selectedNode.fontSize;
            event.datas.baseStrokeWidth = selectedNode.strokeWidth;
            event.datas.baseTracking = selectedNode.tracking;
            event.datas.baseX = selectedNode.x;
            event.datas.baseY = selectedNode.y;
            event.datas.startDistance = Math.max(
              Math.hypot(
                pointer.x - event.datas.anchorClientX,
                pointer.y - event.datas.anchorClientY
              ),
              1
            );
          }}
          origin={false}
          ref={moveableRef}
          renderDirections={["nw", "ne", "sw", "se"]}
          resizable={Boolean(selectedTarget && selectedNode && !editingNodeId)}
          rootContainer={hostRef.current}
          target={selectedTarget}
        />
      </div>
    </DesignerFrame>
  );
};
