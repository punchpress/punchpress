import { getNodeCssTransform } from "@punchpress/engine";
import { useEffect, useState } from "react";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import {
  getTextPathHandleCursorToken,
  setActiveCanvasCursorToken,
} from "../canvas-cursor-policy";
import { getHostRectFromCanvasBounds } from "./canvas-overlay-geometry";

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

const getHostMetrics = (editor) => {
  const host = editor.hostRef;
  const viewer = editor.viewerRef;

  if (!(host && viewer && editor.zoom > 0)) {
    return null;
  }

  const scrollLeft = viewer.getScrollLeft?.();
  const scrollTop = viewer.getScrollTop?.();

  if (!(Number.isFinite(scrollLeft) && Number.isFinite(scrollTop))) {
    return null;
  }

  return {
    height: host.clientHeight,
    scrollLeft,
    scrollTop,
    width: host.clientWidth,
  };
};

const getHostTransformMatrix = (node, bbox, metrics, zoom) => {
  const localCenter = {
    x: (bbox.minX + bbox.maxX) / 2,
    y: (bbox.minY + bbox.maxY) / 2,
  };
  const worldCenter = {
    x: node.transform.x + localCenter.x,
    y: node.transform.y + localCenter.y,
  };
  const rotation = ((node.transform.rotation || 0) * Math.PI) / 180;
  const scaleX = node.transform.scaleX ?? 1;
  const scaleY = node.transform.scaleY ?? 1;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const a = cos * scaleX * zoom;
  const b = sin * scaleX * zoom;
  const c = -sin * scaleY * zoom;
  const d = cos * scaleY * zoom;

  return {
    a,
    b,
    c,
    d,
    e:
      (worldCenter.x - metrics.scrollLeft) * zoom -
      (a * localCenter.x + c * localCenter.y),
    f:
      (worldCenter.y - metrics.scrollTop) * zoom -
      (b * localCenter.x + d * localCenter.y),
  };
};

const projectPoint = (matrix, point) => {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f,
  };
};

const getTransformTargetStyle = (editor, node, geometry) => {
  const selectionBounds = geometry.selectionBounds || geometry.bbox;
  const renderCenter = {
    x: (geometry.bbox.minX + geometry.bbox.maxX) / 2,
    y: (geometry.bbox.minY + geometry.bbox.maxY) / 2,
  };
  const hostRect = getHostRectFromCanvasBounds(editor, {
    height: selectionBounds.height,
    maxX: node.transform.x + selectionBounds.maxX,
    maxY: node.transform.y + selectionBounds.maxY,
    minX: node.transform.x + selectionBounds.minX,
    minY: node.transform.y + selectionBounds.minY,
    width: selectionBounds.width,
  });

  if (!hostRect) {
    return null;
  }

  return {
    height: `${hostRect.height}px`,
    left: `${hostRect.left}px`,
    top: `${hostRect.top}px`,
    transform: getNodeCssTransform(node),
    transformOrigin: `${(renderCenter.x - selectionBounds.minX) * editor.zoom}px ${
      (renderCenter.y - selectionBounds.minY) * editor.zoom
    }px`,
    width: `${hostRect.width}px`,
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

const TextPathHandles = ({ editor, guide, isPathEditing, matrix, nodeId }) => {
  if (!(guide && isPathEditing && matrix && nodeId)) {
    return null;
  }

  const startPositionInteraction = (event, cursorToken) => {
    event.preventDefault();
    event.stopPropagation();

    const session = editor.beginTextPathEdit({
      mode: "position",
      nodeId,
      pointerCanvas: getCanvasPoint(editor, event.clientX, event.clientY),
    });

    if (!session) {
      return;
    }

    const historyMark = editor.markHistoryStep("move text on path");
    editor.setHoveringSuppressed(true);
    setActiveCanvasCursorToken(editor.hostRef, cursorToken);

    const handlePointerMove = (moveEvent) => {
      editor.updateTextPathEdit(session, {
        pointerCanvas: getCanvasPoint(
          editor,
          moveEvent.clientX,
          moveEvent.clientY
        ),
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      editor.setHoveringSuppressed(false);
      setActiveCanvasCursorToken(editor.hostRef, null);
      editor.commitHistoryStep(historyMark);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  return guide.handles.map((handle) => {
    const cursorToken = getTextPathHandleCursorToken(handle.role);
    const point = projectPoint(matrix, handle.point);

    return (
      <button
        className="pointer-events-auto absolute h-6 w-6 rounded-full border-0 bg-transparent p-0 shadow-none"
        data-canvas-cursor={cursorToken || undefined}
        data-testid={`text-path-handle-${handle.key}`}
        key={handle.key}
        onPointerDown={(event) => {
          startPositionInteraction(event, cursorToken);
        }}
        style={{
          left: `${point.x}px`,
          top: `${point.y}px`,
          touchAction: "none",
          transform: "translate(-50%, -50%)",
        }}
        type="button"
      >
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#2f80ff] bg-[#2f80ff]"
        />
      </button>
    );
  });
};

export const CanvasTextPathOverlay = ({ viewportRevision }) => {
  const editor = useEditor();
  const [transformTargetElement, setTransformTargetElement] = useState(null);
  const pathEditingNodeId = useEditorValue(
    (_, state) => state.pathEditingNodeId
  );
  const overlayState = useEditorValue((editor, state) => {
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
  const metrics = overlayState ? getHostMetrics(editor) : null;
  const geometry = overlayState?.geometry || null;
  const node = overlayState?.node || null;
  const transformTargetStyle =
    geometry && node && isPathEditing
      ? getTransformTargetStyle(editor, node, geometry)
      : null;
  const matrix =
    geometry && metrics && node
      ? getHostTransformMatrix(node, geometry.bbox, metrics, editor.zoom)
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

      <TextPathGuide
        guide={guide}
        isPathEditing={isPathEditing}
        matrixTransform={matrixTransform}
        metrics={metrics}
      />

      <TextPathHandles
        editor={editor}
        guide={guide}
        isPathEditing={isPathEditing}
        matrix={matrix}
        nodeId={node?.id || null}
      />
    </div>
  );
};
