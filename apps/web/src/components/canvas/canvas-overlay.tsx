import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Moveable from "react-moveable";
import Selecto from "react-selecto";
import {
  getResizeAnchorFromBounds,
  getScaledGroupNodeUpdate,
} from "../../editor/primitives/group-resize";
import { clamp, round } from "../../editor/primitives/math";
import { isNodeVisible } from "../../editor/shapes/warp-text/model";
import { useEditor } from "../../editor/use-editor";
import { useEditorValue } from "../../editor/use-editor-value";

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

const getGroupResizeScale = (event, baseClientBounds) => {
  const widthScale =
    baseClientBounds.width > 0
      ? event.boundingWidth / baseClientBounds.width
      : null;
  const heightScale =
    baseClientBounds.height > 0
      ? event.boundingHeight / baseClientBounds.height
      : null;

  if (Number.isFinite(widthScale)) {
    return clamp(widthScale, 0.001, 20);
  }

  if (Number.isFinite(heightScale)) {
    return clamp(heightScale, 0.001, 20);
  }

  return 1;
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
  const [selectedTargets, setSelectedTargets] = useState([]);

  const activeTool = useEditorValue((_, state) => state.activeTool);
  const editingNodeId = useEditorValue((_, state) => state.editingNodeId);
  const visibleSelectedNodeIds = useEditorValue((editor, state) => {
    return state.selectedNodeIds.filter((nodeId) => {
      return isNodeVisible(editor.getNode(nodeId));
    });
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

  useEffect(() => {
    setSelectedTargets(
      visibleSelectedNodeIds
        .map((nodeId) => editor.getNodeElement(nodeId))
        .filter(Boolean)
    );
  }, [editor, visibleSelectedNodeIds]);

  useEffect(() => {
    selectoRef.current?.setSelectedTargets?.(selectedTargets);
  }, [selectedTargets]);

  useEffect(() => {
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

  const hostElement = editor.hostRef;
  const keyContainer = typeof window === "undefined" ? undefined : window;
  const selectedTarget = selectedTargets[0] || null;
  const hasGroupSelection = visibleSelectedNodeIds.length > 1;
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
        draggable={isDraggable}
        flushSync={flushSync}
        hideChildMoveableDefaultLines={hasGroupSelection}
        hideDefaultLines={false}
        keepRatio
        onDrag={(event) => {
          if (!selectedNode) {
            return;
          }

          editor.updateNode(selectedNode.id, {
            x: round(event.datas.startX + event.beforeTranslate[0], 2),
            y: round(event.datas.startY + event.beforeTranslate[1], 2),
          });
        }}
        onDragGroup={(event) => {
          const nextSelectedNodeIds = visibleSelectedNodeIds;

          if (nextSelectedNodeIds.length === 0) {
            return;
          }

          editor.updateNodes(nextSelectedNodeIds, (node) => {
            const groupEvent = event.events.find(
              (item) => item.target?.dataset.nodeId === node.id
            );

            if (!groupEvent) {
              return node;
            }

            return {
              x: round(
                groupEvent.datas.startX + groupEvent.beforeTranslate[0],
                2
              ),
              y: round(
                groupEvent.datas.startY + groupEvent.beforeTranslate[1],
                2
              ),
            };
          });
        }}
        onDragGroupStart={(event) => {
          for (const groupEvent of event.events) {
            const nodeId = groupEvent.target?.dataset.nodeId;
            const node = editor.getNode(nodeId);

            groupEvent.datas.startX = node?.x || 0;
            groupEvent.datas.startY = node?.y || 0;
          }
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

          editor.updateNode(selectedNode.id, {
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
        onResizeGroup={(event) => {
          const baseBounds = event.datas.baseBounds;
          const baseClientBounds = event.datas.baseClientBounds;
          const baseNodes = event.datas.baseNodes;

          if (!(baseBounds && baseClientBounds && baseNodes)) {
            return;
          }

          const scale = getGroupResizeScale(event, baseClientBounds);
          const anchor = getResizeAnchorFromBounds(baseBounds, event.direction);

          editor.updateNodes(visibleSelectedNodeIds, (node) => {
            const baseNode = baseNodes.get(node.id);

            if (!baseNode) {
              return node;
            }

            return getScaledGroupNodeUpdate(baseNode, anchor, scale);
          });
        }}
        onResizeGroupStart={(event) => {
          if (!selectedBounds) {
            return;
          }

          const baseClientBounds = getTargetClientBounds(selectedTargets);
          if (!baseClientBounds) {
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

          event.datas.baseBounds = selectedBounds;
          event.datas.baseClientBounds = baseClientBounds;
          event.datas.baseNodes = baseNodes;
        }}
        onResizeStart={(event) => {
          if (!selectedNode) {
            return;
          }

          const bbox = selectedGeometry?.bbox;
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
        resizable={isResizable}
        rootContainer={hostElement}
        target={hasGroupSelection ? null : selectedTarget}
        targets={hasGroupSelection ? selectedTargets : undefined}
      />
    </>
  );
};
