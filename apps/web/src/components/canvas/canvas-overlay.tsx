import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Moveable from "react-moveable";
import Selecto from "react-selecto";
import {
  getResizeCorner,
  getResizedNodeUpdate,
  getScaledGroupNodeUpdate,
} from "../../editor/primitives/group-resize";
import { clamp, round } from "../../editor/primitives/math";
import { getRotatedNodeUpdate } from "../../editor/primitives/rotation";
import { isNodeVisible } from "../../editor/shapes/warp-text/model";
import { estimateBounds } from "../../editor/shapes/warp-text/warp-engine";
import { useEditor } from "../../editor/use-editor";
import { useEditorValue } from "../../editor/use-editor-value";

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

const getTargetClientBounds = (targets) => {
  if (targets.length === 0) {
    return null;
  }

  const rects = targets.map((target) => target.getBoundingClientRect());
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));

  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  };
};

const getRectCenter = (rect) => {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
};

const getResizeHandleSelector = (corner) => {
  return `.canvas-moveable .moveable-control.moveable-${corner}`;
};

const getHandleClientCenter = (hostElement, selector) => {
  const element = hostElement?.querySelector(selector);
  const rect = element?.getBoundingClientRect?.();
  if (!rect) {
    return null;
  }

  return getRectCenter(rect);
};

const getCanvasPointFromClientPoint = (editor, point) => {
  const host = editor.hostRef;
  const viewer = editor.viewerRef;
  if (!(host && viewer && point && editor.zoom > 0)) {
    return null;
  }

  const hostRect = host.getBoundingClientRect();

  return {
    x: viewer.getScrollLeft() + (point.x - hostRect.left) / editor.zoom,
    y: viewer.getScrollTop() + (point.y - hostRect.top) / editor.zoom,
  };
};

const getResizeSession = (editor, hostElement, direction, pointer) => {
  if (!pointer) {
    return null;
  }

  const anchorClient = getHandleClientCenter(
    hostElement,
    getResizeHandleSelector(getResizeCorner(direction, true))
  );
  if (!anchorClient) {
    return null;
  }

  const anchorCanvas = getCanvasPointFromClientPoint(editor, anchorClient);
  if (!anchorCanvas) {
    return null;
  }

  return {
    anchorCanvas,
    anchorClient,
    startDistance: Math.max(
      Math.hypot(pointer.x - anchorClient.x, pointer.y - anchorClient.y),
      1
    ),
  };
};

const getSelectionCenter = (bounds) => {
  if (!bounds) {
    return null;
  }

  return {
    x: bounds.minX + bounds.width / 2,
    y: bounds.minY + bounds.height / 2,
  };
};

const queueMoveableRefresh = (moveableRef) => {
  if (typeof window === "undefined") {
    moveableRef.current?.updateRect?.();
    return;
  }

  window.requestAnimationFrame(() => {
    moveableRef.current?.updateRect?.();
  });
};

const setMoveableMuted = (hostElement, muted) => {
  hostElement?.classList.toggle("canvas-overlay-moveable-muted", muted);
};

const setGroupRotationPreviewActive = (hostElement, active) => {
  hostElement?.classList.toggle("canvas-overlay-group-rotating", active);
};

const getHostRectFromCanvasBounds = (editor, bounds) => {
  const host = editor.hostRef;
  const viewer = editor.viewerRef;

  if (!(host && viewer && bounds && editor.zoom > 0)) {
    return null;
  }

  const scrollLeft = viewer.getScrollLeft?.();
  const scrollTop = viewer.getScrollTop?.();

  if (!(Number.isFinite(scrollLeft) && Number.isFinite(scrollTop))) {
    return null;
  }

  return {
    height: bounds.height * editor.zoom,
    left: (bounds.minX - scrollLeft) * editor.zoom,
    top: (bounds.minY - scrollTop) * editor.zoom,
    width: bounds.width * editor.zoom,
  };
};

const shouldBlockSelectionStart = (target) => {
  if (!(target instanceof Element)) {
    return false;
  }

  if (target.closest(".canvas-node")) {
    return false;
  }

  return Boolean(
    target.closest(
      [
        "button",
        "input",
        "select",
        "textarea",
        "[contenteditable='true']",
        "[role='button']",
        "[role='menu']",
        "[role='menuitem']",
      ].join(",")
    )
  );
};

const getNodeIdsFromSelectionRect = (editor, rect) => {
  if (!rect) {
    return [];
  }

  const left = rect.left;
  const top = rect.top;
  const right = rect.right ?? rect.left + rect.width;
  const bottom = rect.bottom ?? rect.top + rect.height;

  return editor.nodes
    .filter((node) => isNodeVisible(node))
    .map((node) => node.id)
    .filter((nodeId) => {
      const element = editor.getNodeElement(nodeId);
      if (!element) {
        return false;
      }

      const elementRect = element.getBoundingClientRect();
      const overlapWidth =
        Math.min(right, elementRect.right) - Math.max(left, elementRect.left);
      const overlapHeight =
        Math.min(bottom, elementRect.bottom) - Math.max(top, elementRect.top);

      return overlapWidth > 0 && overlapHeight > 0;
    });
};

export const CanvasOverlay = ({ spacePressed }) => {
  const editor = useEditor();
  const moveableRef = useRef(null);
  const selectoRef = useRef(null);
  const [isGroupRotationPreviewVisible, setIsGroupRotationPreviewVisible] =
    useState(false);

  const activeTool = useEditorValue((_, state) => state.activeTool);
  const editingNodeId = useEditorValue((_, state) => state.editingNodeId);
  const visibleSelectedNodeIds = useEditorValue((editor, state) => {
    return state.selectedNodeIds.filter((nodeId) => {
      return isNodeVisible(editor.getNode(nodeId));
    });
  });
  const selectedTargets = useEditorValue((editor, state) => {
    return state.selectedNodeIds
      .filter((nodeId) => isNodeVisible(editor.getNode(nodeId)))
      .map((nodeId) => editor.getNodeElement(nodeId))
      .filter(Boolean);
  });
  const visibleSelectedNodeId = visibleSelectedNodeIds.at(-1) || null;
  const selectedNode = useEditorValue((editor) => {
    if (visibleSelectedNodeIds.length !== 1) {
      return null;
    }

    return editor.getNode(visibleSelectedNodeId);
  });
  const selectedGeometry = useEditorValue((editor) => {
    if (visibleSelectedNodeIds.length !== 1) {
      return null;
    }

    return editor.getNodeGeometry(visibleSelectedNodeId);
  });
  const selectedBounds = useEditorValue((editor) => {
    return editor.getSelectionBounds(visibleSelectedNodeIds);
  });
  const hostElement = editor.hostRef;
  const keyContainer = typeof window === "undefined" ? undefined : window;
  const selectedTarget = selectedTargets[0] || null;
  const hasGroupSelection = visibleSelectedNodeIds.length > 1;
  const groupRotationPreviewRect =
    isGroupRotationPreviewVisible && hasGroupSelection
      ? getHostRectFromCanvasBounds(editor, selectedBounds)
      : null;

  useLayoutEffect(() => {
    selectoRef.current?.setSelectedTargets?.(selectedTargets);
  }, [selectedTargets]);

  useLayoutEffect(() => {
    if (!(selectedTargets.length > 0 && moveableRef.current)) {
      return;
    }

    moveableRef.current.updateRect?.();
  }, [selectedTargets]);

  useEffect(() => {
    const handleViewportChange = () => {
      moveableRef.current?.updateRect?.();
    };
    editor.onViewportChange = handleViewportChange;

    return () => {
      if (editor.onViewportChange === handleViewportChange) {
        editor.onViewportChange = null;
      }
    };
  }, [editor]);

  useEffect(() => {
    if (!hostElement) {
      return;
    }

    const clientBounds =
      selectedTargets.length > 1
        ? getTargetClientBounds(selectedTargets)
        : selectedTarget?.getBoundingClientRect?.() || null;
    const minDimension = clientBounds
      ? Math.min(clientBounds.width, clientBounds.height)
      : 0;
    const offset = clamp(minDimension * 0.18, 12, 36);

    hostElement.style.setProperty("--canvas-rotation-offset", `${offset}px`);

    return () => {
      hostElement.style.removeProperty("--canvas-rotation-offset");
    };
  }, [hostElement, selectedTarget, selectedTargets]);

  useEffect(() => {
    if (!hostElement) {
      return;
    }

    if (
      selectedTargets.length === 0 ||
      editingNodeId ||
      activeTool !== "pointer"
    ) {
      setMoveableMuted(hostElement, false);
    }

    return () => {
      setMoveableMuted(hostElement, false);
    };
  }, [activeTool, editingNodeId, hostElement, selectedTargets.length]);

  useEffect(() => {
    if (!hostElement) {
      return;
    }

    if (!isGroupRotationPreviewVisible) {
      setGroupRotationPreviewActive(hostElement, false);
    }

    return () => {
      setGroupRotationPreviewActive(hostElement, false);
    };
  }, [hostElement, isGroupRotationPreviewVisible]);

  const isDraggable = Boolean(
    activeTool === "pointer" && selectedTargets.length > 0 && !editingNodeId
  );
  const isResizable = Boolean(
    activeTool === "pointer" &&
      selectedTargets.length > 0 &&
      (hasGroupSelection ? selectedBounds : selectedTarget) &&
      (hasGroupSelection || (selectedNode && selectedGeometry)) &&
      !editingNodeId
  );
  const isRotatable = Boolean(
    activeTool === "pointer" &&
      selectedTargets.length > 0 &&
      (hasGroupSelection ? selectedBounds : selectedGeometry) &&
      !editingNodeId
  );

  return (
    <>
      <Selecto
        boundContainer={hostElement}
        className="canvas-selecto"
        container={hostElement}
        dragContainer={keyContainer}
        hitRate={10}
        keyContainer={keyContainer}
        onDragStart={(event) => {
          if (
            spacePressed ||
            event.inputEvent.button !== 0 ||
            activeTool !== "pointer" ||
            shouldBlockSelectionStart(event.inputEvent.target) ||
            moveableRef.current?.isMoveableElement?.(event.inputEvent.target)
          ) {
            event.stop();
          }
        }}
        onSelectEnd={(event) => {
          const nextSelectedNodeIds = getNodeIdsFromSelectionRect(
            editor,
            event.rect
          );

          if (event.inputEvent?.shiftKey) {
            editor.selectNodes([
              ...editor.selectedNodeIds,
              ...nextSelectedNodeIds,
            ]);
            return;
          }

          editor.selectNodes(nextSelectedNodeIds);
        }}
        preventClickEventOnDrag
        preventClickEventOnDragStart
        ref={selectoRef}
        rootContainer={hostElement}
        selectableTargets={[".canvas-node"]}
        selectByClick={false}
        selectFromInside={false}
        toggleContinueSelectWithoutDeselect={["shift"]}
      />

      <Moveable
        className="canvas-moveable"
        container={hostElement}
        controlPadding={32}
        draggable={isDraggable}
        flushSync={flushSync}
        hideChildMoveableDefaultLines={hasGroupSelection}
        hideDefaultLines={false}
        keepRatio
        onDrag={(event) => {
          if (!selectedNode) {
            return;
          }

          setMoveableMuted(hostElement, true);

          const bbox = selectedGeometry?.bbox || estimateBounds(selectedNode);

          editor.updateNode(selectedNode.id, {
            x: round(event.left - bbox.minX, 2),
            y: round(event.top - bbox.minY, 2),
          });
        }}
        onDragEnd={() => {
          setMoveableMuted(hostElement, false);
          queueMoveableRefresh(moveableRef);
        }}
        onDragGroup={(event) => {
          const nextSelectedNodeIds = visibleSelectedNodeIds;

          if (nextSelectedNodeIds.length === 0) {
            return;
          }

          setMoveableMuted(hostElement, true);

          editor.updateNodes(visibleSelectedNodeIds, (node) => {
            const groupEvent = event.events.find(
              (item) => item.target?.dataset.nodeId === node.id
            );

            if (!groupEvent) {
              return node;
            }

            const bbox = groupEvent.datas.bbox;
            if (!bbox) {
              return node;
            }
            return {
              x: round(groupEvent.left - bbox.minX, 2),
              y: round(groupEvent.top - bbox.minY, 2),
            };
          });
        }}
        onDragGroupEnd={() => {
          setMoveableMuted(hostElement, false);
          queueMoveableRefresh(moveableRef);
        }}
        onDragGroupStart={(event) => {
          for (const groupEvent of event.events) {
            const nodeId = groupEvent.target?.dataset.nodeId;
            const node = editor.getNode(nodeId);

            groupEvent.datas.bbox =
              node &&
              (editor.getNodeGeometry(nodeId)?.bbox || estimateBounds(node));
          }
        }}
        onResize={(event) => {
          if (
            !(
              selectedNode &&
              event.datas.baseBBox &&
              event.datas.anchorClient &&
              event.datas.anchorCanvas &&
              event.datas.direction &&
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
              pointer.x - event.datas.anchorClient.x,
              pointer.y - event.datas.anchorClient.y
            ) / event.datas.startDistance,
            0.001,
            20
          );

          editor.updateNode(
            selectedNode.id,
            getResizedNodeUpdate(
              event.datas.baseNode,
              event.datas.baseBBox,
              event.datas.anchorCanvas,
              resizeScale,
              event.datas.direction
            )
          );
        }}
        onResizeEnd={() => {
          queueMoveableRefresh(moveableRef);
        }}
        onResizeGroup={(event) => {
          const anchorCanvas = event.datas.anchorCanvas;
          const baseNodes = event.datas.baseNodes;
          const anchorClient = event.datas.anchorClient;

          if (
            !(
              anchorCanvas &&
              anchorClient &&
              baseNodes &&
              Number.isFinite(event.datas.startDistance)
            )
          ) {
            return;
          }

          const pointer = getResizePointer(event);
          if (!pointer) {
            return;
          }

          const scale = clamp(
            Math.hypot(pointer.x - anchorClient.x, pointer.y - anchorClient.y) /
              event.datas.startDistance,
            0.001,
            20
          );

          editor.updateNodes(visibleSelectedNodeIds, (node) => {
            const baseNode = baseNodes.get(node.id);

            if (!baseNode) {
              return node;
            }

            return getScaledGroupNodeUpdate(baseNode, anchorCanvas, scale);
          });
        }}
        onResizeGroupEnd={() => {
          queueMoveableRefresh(moveableRef);
        }}
        onResizeGroupStart={(event) => {
          const pointer = getResizePointer(event);
          const resizeSession = getResizeSession(
            editor,
            hostElement,
            event.direction,
            pointer
          );

          if (!resizeSession) {
            return;
          }

          const baseNodes = new Map();

          for (const nodeId of visibleSelectedNodeIds) {
            const node = editor.getNode(nodeId);
            if (!node) {
              continue;
            }

            baseNodes.set(nodeId, {
              fontSize: node.fontSize,
              strokeWidth: node.strokeWidth,
              tracking: node.tracking,
              x: node.x,
              y: node.y,
            });
          }

          event.datas.anchorCanvas = resizeSession.anchorCanvas;
          event.datas.anchorClient = resizeSession.anchorClient;
          event.datas.baseNodes = baseNodes;
          event.datas.startDistance = resizeSession.startDistance;
        }}
        onResizeStart={(event) => {
          if (!selectedNode) {
            return;
          }

          const bbox = selectedGeometry?.bbox || estimateBounds(selectedNode);

          const pointer = getResizePointer(event);
          const resizeSession = getResizeSession(
            editor,
            hostElement,
            event.direction,
            pointer
          );

          if (!resizeSession) {
            return;
          }

          event.datas.baseBBox = bbox;
          event.datas.anchorCanvas = resizeSession.anchorCanvas;
          event.datas.anchorClient = resizeSession.anchorClient;
          event.datas.baseNode = {
            fontSize: selectedNode.fontSize,
            rotation: selectedNode.rotation || 0,
            strokeWidth: selectedNode.strokeWidth,
            tracking: selectedNode.tracking,
            x: selectedNode.x,
            y: selectedNode.y,
          };
          event.datas.direction = event.direction;
          event.datas.startDistance = resizeSession.startDistance;
        }}
        onRotate={(event) => {
          if (
            !(
              selectedNode &&
              event.datas.baseNode &&
              event.datas.baseBBox &&
              event.datas.selectionCenter
            )
          ) {
            return;
          }

          editor.updateNode(
            selectedNode.id,
            getRotatedNodeUpdate(
              event.datas.baseNode,
              event.datas.baseBBox,
              event.datas.selectionCenter,
              event.beforeDist
            )
          );
        }}
        onRotateEnd={() => {
          setMoveableMuted(hostElement, false);
          queueMoveableRefresh(moveableRef);
        }}
        onRotateGroup={(event) => {
          const baseNodes = event.datas.baseNodes;
          const selectionCenter = event.datas.selectionCenter;

          if (!(baseNodes && selectionCenter)) {
            return;
          }

          // Keep Moveable's internal group frame stable during drag.
          // The live multi-selection box is rendered as a passive preview instead.
          editor.updateNodes(visibleSelectedNodeIds, (node) => {
            const baseNode = baseNodes.get(node.id);

            if (!baseNode) {
              return node;
            }

            return getRotatedNodeUpdate(
              baseNode,
              baseNode.bbox,
              selectionCenter,
              event.beforeDist
            );
          });
        }}
        onRotateGroupEnd={() => {
          setMoveableMuted(hostElement, false);
          queueMoveableRefresh(moveableRef);

          if (typeof window === "undefined") {
            setGroupRotationPreviewActive(hostElement, false);
            setIsGroupRotationPreviewVisible(false);
            return;
          }

          window.requestAnimationFrame(() => {
            setGroupRotationPreviewActive(hostElement, false);
            setIsGroupRotationPreviewVisible(false);
          });
        }}
        onRotateGroupStart={(event) => {
          const selectionCenter = getSelectionCenter(selectedBounds);

          if (!selectionCenter) {
            return;
          }

          setMoveableMuted(hostElement, true);
          setGroupRotationPreviewActive(hostElement, true);
          setIsGroupRotationPreviewVisible(true);

          const baseNodes = new Map();

          for (const groupEvent of event.events) {
            const nodeId = groupEvent.target?.dataset.nodeId;
            const node = editor.getNode(nodeId);

            if (!node) {
              continue;
            }

            groupEvent.set(node.rotation || 0);

            baseNodes.set(nodeId, {
              bbox:
                editor.getNodeGeometry(nodeId)?.bbox || estimateBounds(node),
              rotation: node.rotation || 0,
              x: node.x,
              y: node.y,
            });
          }

          event.datas.baseNodes = baseNodes;
          event.datas.selectionCenter = selectionCenter;
        }}
        onRotateStart={(event) => {
          if (!selectedNode) {
            return;
          }

          setMoveableMuted(hostElement, true);

          const bbox = selectedGeometry?.bbox || estimateBounds(selectedNode);

          event.set(selectedNode.rotation || 0);
          event.datas.baseBBox = bbox;
          event.datas.baseNode = {
            rotation: selectedNode.rotation || 0,
            x: selectedNode.x,
            y: selectedNode.y,
          };
          event.datas.selectionCenter = getSelectionCenter({
            height: bbox.height,
            maxX: selectedNode.x + bbox.maxX,
            maxY: selectedNode.y + bbox.maxY,
            minX: selectedNode.x + bbox.minX,
            minY: selectedNode.y + bbox.minY,
            width: bbox.width,
          });
        }}
        origin={false}
        ref={moveableRef}
        renderDirections={["nw", "ne", "sw", "se"]}
        resizable={isResizable}
        rootContainer={hostElement}
        rotatable={isRotatable}
        rotateAroundControls
        rotationPosition="none"
        target={hasGroupSelection ? null : selectedTarget}
        targets={hasGroupSelection ? selectedTargets : undefined}
      />

      {groupRotationPreviewRect ? (
        <div
          className="canvas-group-rotation-preview pointer-events-none absolute"
          style={{
            height: `${groupRotationPreviewRect.height}px`,
            left: `${groupRotationPreviewRect.left}px`,
            top: `${groupRotationPreviewRect.top}px`,
            width: `${groupRotationPreviewRect.width}px`,
          }}
        />
      ) : null}
    </>
  );
};
