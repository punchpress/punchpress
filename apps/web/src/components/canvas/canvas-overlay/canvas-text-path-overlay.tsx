import { CircleArrowDataTransferHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorSurfaceValue } from "../../../editor-react/use-editor-surface-value";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import {
  getActiveTextPathHandleCursorToken,
  getTextPathHandleCursorToken,
  setActiveCanvasCursorToken,
} from "../canvas-cursor-policy";
import {
  getTextPathGuideMatrix,
  getTextPathHostMetrics,
  getTextPathTransformTargetStyle,
  projectTextPathPoint,
} from "./text-path-overlay-geometry";

const BEND_HANDLE_ICON_SIZE = 40;
const BEND_HANDLE_SCREEN_GAP = 10;
const BEND_HANDLE_SCREEN_OFFSET =
  BEND_HANDLE_ICON_SIZE / 2 + BEND_HANDLE_SCREEN_GAP;
const POSITION_HANDLE_ICON_SIZE = 40;
const POSITION_HANDLE_SCREEN_GAP = 10;
const POSITION_HANDLE_SCREEN_OFFSET =
  POSITION_HANDLE_ICON_SIZE / 2 + POSITION_HANDLE_SCREEN_GAP;
const WAVE_HANDLE_PAIR_GAP = 8;
const WAVE_HANDLE_PAIR_OFFSET =
  BEND_HANDLE_ICON_SIZE / 2 + WAVE_HANDLE_PAIR_GAP / 2;
const INLINE_WARP_HANDLE_ICON_CLASS =
  "absolute top-1/2 left-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-white drop-shadow-[0_4px_10px_rgba(5,8,15,0.42)] transition-[color,transform,filter] duration-150 ease-out group-hover:scale-110 group-hover:text-[#63a7ff] group-active:scale-95 group-active:text-[#2f80ff] group-active:drop-shadow-[0_2px_6px_rgba(5,8,15,0.3)]";
const POSITION_HANDLE_ICON_CLASS = INLINE_WARP_HANDLE_ICON_CLASS;

const getBoundsCenter = (bounds) => {
  if (!bounds) {
    return null;
  }

  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
};

const getCanvasPoint = (editor, clientX, clientY) => {
  const viewer = editor.viewerRef;
  const host = editor.hostRef;

  if (!(viewer && host)) {
    return { x: 0, y: 0 };
  }

  const rect = host.getBoundingClientRect();

  return {
    x: viewer.getScrollLeft() + (clientX - rect.left) / editor.zoom,
    y: viewer.getScrollTop() + (clientY - rect.top) / editor.zoom,
  };
};

const getProjectedVector = (matrix, vector) => {
  if (!(matrix && vector)) {
    return null;
  }

  return {
    x: matrix.a * vector.x + matrix.c * vector.y,
    y: matrix.b * vector.x + matrix.d * vector.y,
  };
};

const getProjectedVectorAngleDeg = (matrix, vector) => {
  const projectedVector = getProjectedVector(matrix, vector);

  if (!projectedVector) {
    return 0;
  }

  return (Math.atan2(projectedVector.y, projectedVector.x) * 180) / Math.PI;
};

const getProjectedUnitVector = (matrix, vector) => {
  const projectedVector = getProjectedVector(matrix, vector);

  if (!projectedVector) {
    return null;
  }

  const length = Math.hypot(projectedVector.x, projectedVector.y);

  if (length <= 0.001) {
    return null;
  }

  return {
    x: projectedVector.x / length,
    y: projectedVector.y / length,
  };
};

const TextPathHandleIcon = ({ className, iconSize, rotationDeg = 0 }) => {
  return (
    <span aria-hidden="true" className={className}>
      <span
        className="flex items-center justify-center"
        style={{ transform: `rotate(${rotationDeg}deg)` }}
      >
        <HugeiconsIcon
          color="currentColor"
          icon={CircleArrowDataTransferHorizontalIcon}
          size={iconSize}
          strokeWidth={1.9}
        />
      </span>
    </span>
  );
};

const offsetProjectedPoint = (matrix, point, localVector, screenDistance) => {
  const projectedPoint = projectTextPathPoint(matrix, point);

  if (!(projectedPoint && localVector && Number.isFinite(screenDistance))) {
    return projectedPoint;
  }

  const projectedVector = {
    x: matrix.a * localVector.x + matrix.c * localVector.y,
    y: matrix.b * localVector.x + matrix.d * localVector.y,
  };
  const vectorLength = Math.hypot(projectedVector.x, projectedVector.y);

  if (vectorLength <= 0.001) {
    return projectedPoint;
  }

  return {
    x: projectedPoint.x + (projectedVector.x / vectorLength) * screenDistance,
    y: projectedPoint.y + (projectedVector.y / vectorLength) * screenDistance,
  };
};

const offsetScreenPoint = (matrix, point, localVector, screenDistance) => {
  if (!(point && matrix && localVector && Number.isFinite(screenDistance))) {
    return point;
  }

  const projectedVector = {
    x: matrix.a * localVector.x + matrix.c * localVector.y,
    y: matrix.b * localVector.x + matrix.d * localVector.y,
  };
  const vectorLength = Math.hypot(projectedVector.x, projectedVector.y);

  if (vectorLength <= 0.001) {
    return point;
  }

  return {
    x: point.x + (projectedVector.x / vectorLength) * screenDistance,
    y: point.y + (projectedVector.y / vectorLength) * screenDistance,
  };
};

const getCirclePathHandlePoint = (guide, handle) => {
  if (!(guide?.kind === "circle" && handle?.point)) {
    return handle?.point || null;
  }

  const radialVector = {
    x: handle.point.x - guide.center.x,
    y: handle.point.y - guide.center.y,
  };
  const radialLength = Math.hypot(radialVector.x, radialVector.y);

  if (radialLength <= 0.001) {
    return handle.point;
  }

  return {
    x: guide.center.x + (radialVector.x / radialLength) * guide.radius,
    y: guide.center.y + (radialVector.y / radialLength) * guide.radius,
  };
};

const TextPathGuide = ({ guide, isPathEditing, matrixTransform, metrics }) => {
  if (!(guide && metrics && matrixTransform)) {
    return null;
  }

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full overflow-visible"
      data-testid="text-path-guide"
      height={metrics.height}
      width={metrics.width}
    >
      <g transform={matrixTransform}>
        <path
          d={guide.pathD}
          fill="none"
          pointerEvents="none"
          stroke={isPathEditing ? "#63a7ff" : "#a2a9b4"}
          strokeOpacity={isPathEditing ? "0.35" : "0.1"}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={guide.activePathD}
          fill="none"
          pointerEvents="none"
          stroke={isPathEditing ? "#2f80ff" : "#d6dbe4"}
          strokeLinecap="round"
          strokeOpacity={isPathEditing ? "0.95" : "0.44"}
          strokeWidth={isPathEditing ? "2.5" : "2"}
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
};

const SPRING_MAX_OFFSET = 5;
const SPRING_DAMPING = 0.15;
const SPRING_TRANSITION = "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";

const TextPathHandles = ({
  bbox,
  editor,
  guide,
  isPathEditing,
  matrix,
  nodeId,
}) => {
  const [springState, setSpringState] = useState(null);
  const shouldShowHandles = Boolean(
    guide && matrix && nodeId && (isPathEditing || guide.kind !== "circle")
  );

  if (!shouldShowHandles) {
    return null;
  }

  const renderCenter = getBoundsCenter(bbox);
  const localXAxisRotationDeg = getProjectedVectorAngleDeg(matrix, {
    x: 1,
    y: 0,
  });
  const localXAxisUnit = getProjectedUnitVector(matrix, { x: 1, y: 0 });
  const localYAxisUnit = getProjectedUnitVector(matrix, { x: 0, y: 1 });

  const startHandleInteraction = (event, handle, cursorToken) => {
    event.preventDefault();
    event.stopPropagation();

    const session = editor.beginTextPathEdit({
      mode: handle.role,
      nodeId,
      pointerCanvas: getCanvasPoint(editor, event.clientX, event.clientY),
    });

    if (!session) {
      return;
    }

    const startClientX = event.clientX;
    const startClientY = event.clientY;

    const historyMark = editor.markHistoryStep(
      guide.kind === "circle" && handle.role === "position"
        ? "move text on path"
        : "adjust text warp"
    );
    editor.beginTextPathPositioningInteraction();
    setActiveCanvasCursorToken(
      editor.hostRef,
      getActiveTextPathHandleCursorToken(handle.role) || cursorToken
    );

    const handlePointerMove = (moveEvent) => {
      editor.updateTextPathEdit(session, {
        pointerCanvas: getCanvasPoint(
          editor,
          moveEvent.clientX,
          moveEvent.clientY
        ),
      });

      const springDisabled =
        guide.kind === "circle" ||
        (guide.kind === "wave" && handle.role === "amplitude") ||
        (guide.kind === "arch" && handle.role === "bend");

      if (!springDisabled) {
        const springAxis =
          handle.role === "bend" ||
          handle.role === "amplitude" ||
          handle.role === "slant"
            ? localYAxisUnit
            : localXAxisUnit;
        const pointerDelta = {
          x: moveEvent.clientX - startClientX,
          y: moveEvent.clientY - startClientY,
        };
        const raw = springAxis
          ? pointerDelta.x * springAxis.x + pointerDelta.y * springAxis.y
          : 0;
        const clamped = Math.max(
          -SPRING_MAX_OFFSET,
          Math.min(SPRING_MAX_OFFSET, raw * SPRING_DAMPING)
        );

        setSpringState({
          dx: (springAxis?.x || 0) * clamped,
          dy: (springAxis?.y || 0) * clamped,
          key: handle.key,
        });
      }
    };

    const handlePointerEnd = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointercancel", handlePointerEnd);
      window.removeEventListener("pointerup", handlePointerEnd);
      editor.endTextPathPositioningInteraction();
      setActiveCanvasCursorToken(editor.hostRef, null);
      editor.commitHistoryStep(historyMark);
      setSpringState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointercancel", handlePointerEnd);
    window.addEventListener("pointerup", handlePointerEnd);
  };

  return guide.handles.map((handle) => {
    const isVerticalWarpHandle =
      handle.role === "bend" ||
      handle.role === "amplitude" ||
      handle.role === "slant";
    const isInlineWarpHandle = guide.kind !== "circle";
    const cursorToken = getTextPathHandleCursorToken(handle.role);
    const circlePathPoint =
      guide.kind === "circle" && handle.role === "position"
        ? getCirclePathHandlePoint(guide, handle)
        : null;
    const pointRotationDeg = circlePathPoint
      ? getProjectedVectorAngleDeg(matrix, {
          x: circlePathPoint.x - guide.center.x,
          y: circlePathPoint.y - guide.center.y,
        })
      : 0;
    const point = (() => {
      if (handle.role === "bend") {
        return offsetProjectedPoint(
          matrix,
          handle.point,
          { x: 0, y: -1 },
          BEND_HANDLE_SCREEN_OFFSET
        );
      }

      if (guide.kind === "wave" && guide.topHandlePoint) {
        const topRailPoint = offsetProjectedPoint(
          matrix,
          guide.topHandlePoint,
          { x: 0, y: -1 },
          BEND_HANDLE_SCREEN_OFFSET
        );

        return offsetScreenPoint(
          matrix,
          topRailPoint,
          { x: 1, y: 0 },
          handle.role === "amplitude"
            ? WAVE_HANDLE_PAIR_OFFSET
            : -WAVE_HANDLE_PAIR_OFFSET
        );
      }

      if (
        guide.kind === "slant" &&
        renderCenter &&
        Number.isFinite(guide.topHandleOffsetY)
      ) {
        return offsetProjectedPoint(
          matrix,
          {
            x: renderCenter.x,
            y: renderCenter.y + guide.topHandleOffsetY,
          },
          { x: 0, y: -1 },
          BEND_HANDLE_SCREEN_OFFSET
        );
      }

      if (guide.kind === "circle" && handle.role === "position") {
        return offsetProjectedPoint(
          matrix,
          circlePathPoint,
          {
            x: guide.center.x - circlePathPoint.x,
            y: guide.center.y - circlePathPoint.y,
          },
          POSITION_HANDLE_SCREEN_OFFSET
        );
      }

      return projectTextPathPoint(matrix, handle.point);
    })();
    const icon = (() => {
      if (isVerticalWarpHandle) {
        return (
          <TextPathHandleIcon
            className={INLINE_WARP_HANDLE_ICON_CLASS}
            iconSize={BEND_HANDLE_ICON_SIZE}
            rotationDeg={localXAxisRotationDeg - 90}
          />
        );
      }

      if (guide.kind === "circle" && handle.role === "position") {
        return (
          <TextPathHandleIcon
            className={POSITION_HANDLE_ICON_CLASS}
            iconSize={POSITION_HANDLE_ICON_SIZE}
            rotationDeg={pointRotationDeg + 90}
          />
        );
      }

      return (
        <TextPathHandleIcon
          className={INLINE_WARP_HANDLE_ICON_CLASS}
          iconSize={POSITION_HANDLE_ICON_SIZE}
          rotationDeg={localXAxisRotationDeg}
        />
      );
    })();

    const isSpringActive = springState?.key === handle.key;
    const springDx = isSpringActive ? springState.dx : 0;
    const springDy = isSpringActive ? springState.dy : 0;

    return (
      <button
        className={`group pointer-events-auto absolute rounded-full border-0 bg-transparent p-0 shadow-none ${
          isInlineWarpHandle ? "h-11 w-11" : "h-4 w-4"
        }`}
        data-canvas-cursor={cursorToken || undefined}
        data-testid={`text-path-handle-${handle.key}`}
        key={handle.key}
        onPointerDown={(event) => {
          startHandleInteraction(event, handle, cursorToken);
        }}
        style={{
          left: `${point.x}px`,
          top: `${point.y}px`,
          touchAction: "none",
          transform: `translate(-50%, -50%) translate(${springDx}px, ${springDy}px)`,
          transition: isSpringActive ? "none" : SPRING_TRANSITION,
        }}
        type="button"
      >
        {icon}
      </button>
    );
  });
};

export const CanvasTextPathOverlay = ({ viewportRevision }) => {
  const editor = useEditor();
  const [transformTargetElement, setTransformTargetElement] = useState(null);
  const isSelectionRotating = useEditorValue(
    (_, state) => state.isSelectionRotating
  );
  const pathEditingNodeId = useEditorValue(
    (_, state) => state.pathEditingNodeId
  );
  const overlayState = useEditorSurfaceValue((editor, state) => {
    if (state.editingNodeId) {
      return null;
    }

    const visibleSelectedNodeIds = state.selectedNodeIds.filter((nodeId) => {
      return (
        editor.isNodeEffectivelyVisible(nodeId) &&
        Boolean(editor.getNodeFrame(nodeId))
      );
    });

    if (visibleSelectedNodeIds.length !== 1) {
      return null;
    }

    const node = editor.getNode(visibleSelectedNodeIds[0]);

    if (node?.type !== "text") {
      return null;
    }

    const geometry = editor.getNodeGeometry(node.id);

    if (!geometry?.guide) {
      return null;
    }

    return {
      geometry,
      node,
      previewDelta:
        editor.getSelectionPreviewDelta(visibleSelectedNodeIds) || null,
    };
  });
  const nodeId = overlayState?.node.id || null;
  const isPathEditing = Boolean(nodeId && pathEditingNodeId === nodeId);

  useEffect(() => {
    if (!(nodeId && !isPathEditing && editor.getNodeTransformElement(nodeId))) {
      return;
    }

    editor.registerNodeTransformElement(nodeId, null);
    editor.onViewportChange?.();
  }, [editor, isPathEditing, nodeId]);

  useEffect(() => {
    if (!(nodeId && isPathEditing && transformTargetElement)) {
      return;
    }

    editor.registerNodeTransformElement(nodeId, transformTargetElement);
    editor.onViewportChange?.();

    return () => {
      if (editor.getNodeTransformElement(nodeId) === transformTargetElement) {
        editor.registerNodeTransformElement(nodeId, null);
        editor.onViewportChange?.();
      }
    };
  }, [editor, isPathEditing, nodeId, transformTargetElement]);

  if (!overlayState) {
    return null;
  }
  const metrics = overlayState ? getTextPathHostMetrics(editor) : null;
  const geometry = overlayState?.geometry || null;
  const node = overlayState?.node || null;
  const previewDelta = overlayState?.previewDelta || null;
  const transformTargetStyle =
    geometry && node && isPathEditing
      ? getTextPathTransformTargetStyle(
          editor,
          node,
          geometry,
          previewDelta,
          true
        )
      : null;
  const matrix =
    geometry && metrics && node
      ? getTextPathGuideMatrix(
          node,
          geometry,
          metrics,
          editor.zoom,
          previewDelta
        )
      : null;
  const guide = geometry?.guide || null;
  const matrixTransform = matrix
    ? `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`
    : null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      data-viewport-revision={viewportRevision}
    >
      {isPathEditing && transformTargetStyle ? (
        <div
          className="canvas-text-path-target pointer-events-none absolute"
          data-node-id={node.id}
          ref={setTransformTargetElement}
          style={transformTargetStyle}
        />
      ) : null}

      {isSelectionRotating ? null : (
        <TextPathGuide
          guide={guide}
          isPathEditing={isPathEditing}
          matrixTransform={matrixTransform}
          metrics={metrics}
        />
      )}

      <TextPathHandles
        bbox={geometry?.bbox || null}
        editor={editor}
        guide={guide}
        isPathEditing={isPathEditing}
        matrix={matrix}
        nodeId={node?.id || null}
      />
    </div>
  );
};
