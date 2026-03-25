import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import Moveable from "react-moveable";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { drillIntoGroupSelection } from "../canvas-group-drill-in";
import { CanvasGroupRotationPreview } from "./canvas-group-rotation-preview";
import { CanvasSelectionDragPreview } from "./canvas-selection-drag-preview";
import { getCanvasTransformHandlers } from "./canvas-transform-handlers";
import { useCanvasTransformEffects } from "./use-canvas-transform-effects";
import { useCanvasTransformState } from "./use-canvas-transform-state";

export const CanvasTransformOverlay = ({ viewportRevision }) => {
  const editor = useEditor();
  const moveableRef = useRef(null);
  const [isGroupRotationPreviewVisible, setIsGroupRotationPreviewVisible] =
    useState(false);

  const {
    activeTool,
    editingNodeId,
    effectiveSelectedNodeIds,
    groupRotationPreviewRect,
    hasGroupSelection,
    hostElement,
    isDraggable,
    isPathEditingSelection,
    isResizable,
    isRotatable,
    selectedBounds,
    selectedEditCapabilities,
    selectedNode,
    selectionPreview,
    selectedTarget,
    selectedTargets,
    selectionFrameKey,
    visibleSelectedNodeIds,
    zoom,
  } = useCanvasTransformState(editor, isGroupRotationPreviewVisible);
  const isSelectionDragging = useEditorValue(
    (_, state) => state.isSelectionDragging
  );
  const isSelectionRotating = useEditorValue(
    (_, state) => state.isSelectionRotating
  );
  const suppressHover = () => {
    editor.setHoveringSuppressed(true);
  };
  const restoreHover = () => {
    editor.setHoveringSuppressed(false);
  };

  const { queueMoveableRefresh } = useCanvasTransformEffects({
    activeTool,
    editingNodeId,
    hostElement,
    isSelectionDragging,
    isSelectionRotating,
    isGroupRotationPreviewVisible,
    moveableRef,
    selectedTarget,
    selectedTargets,
    selectionFrameKey,
    viewportRevision,
  });
  const moveableHandlers = getCanvasTransformHandlers({
    editor,
    hostElement,
    queueRefresh: queueMoveableRefresh,
    restoreHover,
    selectedBounds,
    selectedEditCapabilities,
    selectedNode,
    setIsGroupRotationPreviewVisible,
    suppressHover,
    visibleSelectedNodeIds,
  });
  const shouldRenderMoveable =
    activeTool === "pointer" &&
    !editingNodeId &&
    selectedTargets.length > 0 &&
    Boolean(hostElement);
  let moveableModeKey = "node";

  if (hasGroupSelection) {
    moveableModeKey = "group";
  } else if (isPathEditingSelection) {
    moveableModeKey = "path";
  }

  return (
    <>
      {shouldRenderMoveable ? (
        <Moveable
          className="canvas-moveable"
          container={hostElement}
          controlPadding={32}
          draggable={isDraggable}
          flushSync={flushSync}
          hideChildMoveableDefaultLines={
            hasGroupSelection || Boolean(editingNodeId)
          }
          hideDefaultLines={Boolean(editingNodeId)}
          keepRatio
          key={`moveable:${selectedNode?.id || "selection"}:${moveableModeKey}`}
          onClickGroup={({ isDouble, targetIndex }) => {
            if (!(isDouble && selectedNode?.type === "group")) {
              return;
            }

            const childNodeId = effectiveSelectedNodeIds[targetIndex];
            if (!childNodeId) {
              return;
            }

            drillIntoGroupSelection(editor, childNodeId);
          }}
          {...moveableHandlers}
          origin={false}
          ref={moveableRef}
          renderDirections={["nw", "ne", "sw", "se"]}
          resizable={isResizable}
          rootContainer={hostElement}
          rotatable={isRotatable}
          rotateAroundControls
          rotationPosition="none"
          target={editingNodeId || hasGroupSelection ? null : selectedTarget}
          targets={
            editingNodeId || !hasGroupSelection ? undefined : selectedTargets
          }
        />
      ) : null}

      {isSelectionDragging ? (
        <CanvasSelectionDragPreview
          delta={selectionPreview}
          hostElement={hostElement}
          isVisible={isSelectionDragging}
          zoom={zoom}
        />
      ) : null}

      <CanvasGroupRotationPreview rect={groupRotationPreviewRect} />
    </>
  );
};
