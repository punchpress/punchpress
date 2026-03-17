import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import Moveable from "react-moveable";
import { useEditor } from "../../../editor-react/use-editor";
import { drillIntoGroupSelection } from "../canvas-group-drill-in";
import { CanvasGroupRotationPreview } from "./canvas-group-rotation-preview";
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
    isResizable,
    isRotatable,
    selectedBounds,
    selectedGeometry,
    selectedNode,
    selectedTarget,
    selectedTargets,
    selectionFrameKey,
    visibleSelectedNodeIds,
  } = useCanvasTransformState(editor, isGroupRotationPreviewVisible);
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
    selectedGeometry,
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

      <CanvasGroupRotationPreview rect={groupRotationPreviewRect} />
    </>
  );
};
