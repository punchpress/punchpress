import { HugeiconsIcon } from "@hugeicons/react";
import { CircleArrowDataTransferHorizontalIcon } from "@hugeicons-pro/core-stroke-rounded";
import { clamp } from "@punchpress/engine";
import { useEffect, useState } from "react";
import { useEditor } from "../../../../editor-react/use-editor";
import { useEditorSurfaceValue } from "../../../../editor-react/use-editor-surface-value";
import {
  getActiveTextPathHandleCursorToken,
  getTextPathHandleCursorToken,
  setActiveCanvasCursorToken,
} from "../../canvas-cursor-policy";
import { CanvasGuide } from "../visuals/guide";
import {
  CANVAS_HANDLE_BUTTON_CLASS,
  CANVAS_HANDLE_ICON_CLASS,
} from "../visuals/handles";
import {
  getTextPathGuideMatrix,
  getTextPathHostMetrics,
  getTextPathTransformTargetStyle,
  projectTextPathPoint,
} from "./path-geometry";

const BEND_HANDLE_ICON_SIZE = 40;
const BEND_HANDLE_SCREEN_GAP = 10;
const ARCH_HANDLE_SCREEN_GAP = 62;
const POSITION_HANDLE_ICON_SIZE = 40;
const POSITION_HANDLE_SCREEN_GAP = 10;
const WAVE_HANDLE_SCREEN_GAP = 65;
const WAVE_HANDLE_PAIR_GAP = 8;
const INLINE_WARP_HANDLE_ICON_CLASS = CANVAS_HANDLE_ICON_CLASS;
const POSITION_HANDLE_ICON_CLASS = INLINE_WARP_HANDLE_ICON_CLASS;

const easeOutCubic = (t) => {
  return 1 - (1 - t) ** 3;
};

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

const isVerticalWarpHandle = (handle) => {
  return (
    handle.role === "bend" ||
    handle.role === "amplitude" ||
    handle.role === "slant"
  );
};

const getLowZoomScale = (zoom, minScale) => {
  if (!Number.isFinite(zoom)) {
    return 1;
  }

  return clamp((zoom - 0.12) / (0.55 - 0.12), 0, 1) * (1 - minScale) + minScale;
};

const getTextPathHandleVisualScale = (zoom) => {
  return getLowZoomScale(zoom, 0.72);
};

const getTextPathHandleOffsetScale = (zoom) => {
  if (!Number.isFinite(zoom)) {
    return 1;
  }

  const t = clamp((zoom - 0.1) / (1 - 0.1), 0, 1);

  return 0.28 + easeOutCubic(t) * 0.72;
};

const getScaledIconSize = (iconSize, scale) => {
  return Math.round(iconSize * scale * 10) / 10;
};

const getScreenOffsetFromGap = (iconSize, scale, gap, offsetScale = 1) => {
  return getScaledIconSize(iconSize, scale) / 2 + gap * offsetScale;
};

const getWavePairOffset = (scale, offsetScale = 1) => {
  return (
    getScaledIconSize(BEND_HANDLE_ICON_SIZE, scale) / 2 +
    (WAVE_HANDLE_PAIR_GAP * offsetScale) / 2
  );
};

const TextPathHandleIcon = ({
  className,
  iconSize,
  rotationDeg = 0,
  scale = 1,
}) => {
  const scaledIconSize = getScaledIconSize(iconSize, scale);

  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        height: `${scaledIconSize}px`,
        width: `${scaledIconSize}px`,
      }}
    >
      <span
        className="flex items-center justify-center"
        style={{ transform: `rotate(${rotationDeg}deg)` }}
      >
        <HugeiconsIcon
          color="currentColor"
          icon={CircleArrowDataTransferHorizontalIcon}
          size={scaledIconSize}
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

const getTextPathHandlePoint = ({
  guide,
  handle,
  matrix,
  offsetScale,
  scale,
  renderCenter,
}) => {
  if (handle.role === "bend") {
    return offsetProjectedPoint(
      matrix,
      handle.point,
      { x: 0, y: -1 },
      getScreenOffsetFromGap(
        BEND_HANDLE_ICON_SIZE,
        scale,
        ARCH_HANDLE_SCREEN_GAP,
        offsetScale
      )
    );
  }

  if (guide.kind === "wave" && guide.handleAnchorPoint) {
    const anchoredPoint = offsetProjectedPoint(
      matrix,
      guide.handleAnchorPoint,
      { x: 0, y: -1 },
      getScreenOffsetFromGap(
        BEND_HANDLE_ICON_SIZE,
        scale,
        WAVE_HANDLE_SCREEN_GAP,
        offsetScale
      )
    );

    return offsetScreenPoint(
      matrix,
      anchoredPoint,
      { x: 1, y: 0 },
      handle.role === "amplitude"
        ? getWavePairOffset(scale, offsetScale)
        : -getWavePairOffset(scale, offsetScale)
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
      getScreenOffsetFromGap(
        BEND_HANDLE_ICON_SIZE,
        scale,
        BEND_HANDLE_SCREEN_GAP,
        offsetScale
      )
    );
  }

  if (guide.kind === "circle" && handle.role === "position") {
    const circlePathPoint = getCirclePathHandlePoint(guide, handle);

    return offsetProjectedPoint(
      matrix,
      circlePathPoint,
      {
        x: guide.center.x - circlePathPoint.x,
        y: guide.center.y - circlePathPoint.y,
      },
      getScreenOffsetFromGap(
        POSITION_HANDLE_ICON_SIZE,
        scale,
        POSITION_HANDLE_SCREEN_GAP,
        offsetScale
      )
    );
  }

  return projectTextPathPoint(matrix, handle.point);
};

const getTextPathHandleIcon = ({
  guide,
  handle,
  iconRotationDeg,
  localXAxisRotationDeg,
  matrix,
  scale,
}) => {
  if (isVerticalWarpHandle(handle)) {
    return (
      <TextPathHandleIcon
        className={INLINE_WARP_HANDLE_ICON_CLASS}
        iconSize={BEND_HANDLE_ICON_SIZE}
        rotationDeg={localXAxisRotationDeg - 90}
        scale={scale}
      />
    );
  }

  if (guide.kind === "circle" && handle.role === "position") {
    const circlePathPoint = getCirclePathHandlePoint(guide, handle);
    const pointRotationDeg = getProjectedVectorAngleDeg(matrix, {
      x: circlePathPoint.x - guide.center.x,
      y: circlePathPoint.y - guide.center.y,
    });

    return (
      <TextPathHandleIcon
        className={POSITION_HANDLE_ICON_CLASS}
        iconSize={POSITION_HANDLE_ICON_SIZE}
        rotationDeg={pointRotationDeg + 90}
        scale={scale}
      />
    );
  }

  return (
    <TextPathHandleIcon
      className={INLINE_WARP_HANDLE_ICON_CLASS}
      iconSize={POSITION_HANDLE_ICON_SIZE}
      rotationDeg={iconRotationDeg}
      scale={scale}
    />
  );
};

const SPRING_MAX_OFFSET = 5;
const SPRING_DAMPING = 0.15;
const SPRING_TRANSITION = "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";

const getTextPathGuideRenderState = (editor, overlayState, isPathEditing) => {
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

  return {
    geometry,
    guide,
    matrix,
    matrixTransform,
    metrics,
    node,
    transformTargetStyle,
  };
};

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
  const handleVisualScale = getTextPathHandleVisualScale(editor.zoom);
  const handleOffsetScale = getTextPathHandleOffsetScale(editor.zoom);
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
    const isInlineWarpHandle = guide.kind !== "circle";
    const cursorToken = getTextPathHandleCursorToken(handle.role);
    const rawPoint = getTextPathHandlePoint({
      guide,
      handle,
      matrix,
      offsetScale: handleOffsetScale,
      scale: handleVisualScale,
      renderCenter,
    });
    const point = rawPoint;
    const icon = getTextPathHandleIcon({
      guide,
      handle,
      iconRotationDeg: localXAxisRotationDeg,
      localXAxisRotationDeg,
      matrix,
      scale: handleVisualScale,
    });

    const isSpringActive = springState?.key === handle.key;
    const springDx = isSpringActive ? springState.dx : 0;
    const springDy = isSpringActive ? springState.dy : 0;

    return (
      <button
        className={`${CANVAS_HANDLE_BUTTON_CLASS} ${
          isInlineWarpHandle ? "" : "h-4 w-4"
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

export const CanvasTextPathGuides = ({ viewportRevision }) => {
  const editor = useEditor();
  const [transformTargetElement, setTransformTargetElement] = useState(null);
  const overlayState = useEditorSurfaceValue((editor) => {
    return editor.getTextPathOverlayState();
  });
  const nodeId = overlayState?.node.id || null;
  const isPathEditing = overlayState?.isPathEditing;

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
  const isSelectionRotating = overlayState?.isSelectionRotating;
  const isTextPathPositioning = overlayState?.isTextPathPositioning;
  const {
    geometry,
    guide,
    matrix,
    matrixTransform,
    metrics,
    node,
    transformTargetStyle,
  } = getTextPathGuideRenderState(editor, overlayState, isPathEditing);
  const shouldRenderGuide =
    !isSelectionRotating &&
    guide &&
    metrics &&
    matrixTransform &&
    (isPathEditing || isTextPathPositioning);

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

      {shouldRenderGuide ? (
        <CanvasGuide
          activePathD={guide.activePathD}
          height={metrics.height}
          isEditing={isPathEditing}
          pathD={guide.pathD}
          transform={matrixTransform}
          width={metrics.width}
        />
      ) : null}

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
