import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Moveable from "react-moveable";
import Selecto from "react-selecto";
import { clamp, round } from "../../editor/primitives/math";
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

export const CanvasOverlay = ({ spacePressed }) => {
  const editor = useEditor();
  const moveableRef = useRef(null);
  const [selectedTarget, setSelectedTarget] = useState(null);

  const activeTool = useEditorValue((_, state) => state.activeTool);
  const editingNodeId = useEditorValue((_, state) => state.editingNodeId);
  const selectedNodeId = useEditorValue((_, state) => state.selectedNodeId);
  const selectedNode = useEditorValue((editor) => editor.selectedNode);
  const selectedGeometry = useEditorValue((editor, state) => {
    if (!state.selectedNodeId) {
      return null;
    }

    return editor.getNodeGeometry(state.selectedNodeId);
  });

  useEffect(() => {
    setSelectedTarget(
      selectedNodeId ? editor.getNodeElement(selectedNodeId) : null
    );
  }, [editor, selectedNodeId]);

  useEffect(() => {
    if (!(selectedTarget && moveableRef.current)) {
      return;
    }

    moveableRef.current.updateRect?.();
  }, [selectedTarget]);

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
  const isDraggable = Boolean(
    activeTool === "pointer" && selectedTarget && !editingNodeId
  );
  const isResizable = Boolean(
    activeTool === "pointer" &&
      selectedTarget &&
      selectedNode &&
      selectedGeometry &&
      !editingNodeId
  );

  return (
    <>
      <Selecto
        boundContainer={hostElement}
        className="canvas-selecto"
        container={hostElement}
        dragContainer={hostElement}
        hitRate={10}
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
          const nextTarget = event.selected.at(-1);
          editor.selectNode(nextTarget?.dataset.nodeId || null);
        }}
        rootContainer={hostElement}
        selectableTargets={[".canvas-node"]}
        selectByClick={false}
        selectFromInside={false}
      />

      <Moveable
        className="canvas-moveable"
        container={hostElement}
        draggable={isDraggable}
        flushSync={flushSync}
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
        target={selectedTarget}
      />
    </>
  );
};
