import { useLayoutEffect, useRef, useState } from "react";
import Selecto from "react-selecto";
import { useEditor } from "../../../../editor-react/use-editor";
import { useEditorValue } from "../../../../editor-react/use-editor-value";
import { getHostRectFromNodeFrame } from "../canvas-overlay-geometry";
import { shouldBlockSelectionStart } from "../canvas-overlay-interactions";
import {
  CanvasNodePathPreview,
  getNodePathHostPreview,
} from "../visuals/node-path-preview";

const getUniqueNodeIds = (nodeIds) => {
  return nodeIds.filter(Boolean).filter((nodeId, index, values) => {
    return values.indexOf(nodeId) === index;
  });
};

const getNodeIdsFromSelectedTargets = (targets) => {
  return getUniqueNodeIds(
    (targets || [])
      .map((target) => {
        if (!(target instanceof HTMLElement)) {
          return null;
        }

        return target.dataset.nodeId || null;
      })
      .filter(Boolean)
  );
};

const isEditableCurveNode = (node) => {
  return (
    node?.type === "path" ||
    node?.type === "shape" ||
    (node?.type === "vector" &&
      Array.isArray(node.contours) &&
      node.contours.length > 0)
  );
};

const getCanvasPoint = (editor, clientX, clientY) => {
  const host = editor.hostRef;
  const viewer = editor.viewerRef;

  if (!(host && viewer && editor.zoom > 0)) {
    return null;
  }

  const hostRect = host.getBoundingClientRect();

  return {
    x: viewer.getScrollLeft() + (clientX - hostRect.left) / editor.zoom,
    y: viewer.getScrollTop() + (clientY - hostRect.top) / editor.zoom,
  };
};

const getMarqueeClientRect = (event, fallbackRect = null) => {
  const sourceRect = fallbackRect || event.rect;

  if (!sourceRect) {
    return null;
  }

  const left = sourceRect.left ?? sourceRect.x;
  const top = sourceRect.top ?? sourceRect.y;
  const right = sourceRect.right ?? left + sourceRect.width;
  const bottom = sourceRect.bottom ?? top + sourceRect.height;

  if (
    !(
      Number.isFinite(left) &&
      Number.isFinite(top) &&
      Number.isFinite(right) &&
      Number.isFinite(bottom)
    )
  ) {
    return null;
  }

  return {
    bottom: Math.max(top, bottom),
    left: Math.min(left, right),
    right: Math.max(left, right),
    top: Math.min(top, bottom),
  };
};

const getMarqueeCanvasBounds = (editor, event, fallbackRect = null) => {
  const rect = getMarqueeClientRect(event, fallbackRect);

  if (!rect) {
    return null;
  }

  const start = getCanvasPoint(editor, rect.left, rect.top);
  const end = getCanvasPoint(editor, rect.right, rect.bottom);

  if (!(start && end)) {
    return null;
  }

  const minX = Math.min(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxX = Math.max(start.x, end.x);
  const maxY = Math.max(start.y, end.y);

  return {
    height: maxY - minY,
    maxX,
    maxY,
    minX,
    minY,
    width: maxX - minX,
  };
};

const boundsIntersect = (a, b) => {
  return !(
    a.maxX < b.minX ||
    a.minX > b.maxX ||
    a.maxY < b.minY ||
    a.minY > b.maxY
  );
};

const boundsContain = (outer, inner) => {
  return (
    inner.minX >= outer.minX &&
    inner.maxX <= outer.maxX &&
    inner.minY >= outer.minY &&
    inner.maxY <= outer.maxY
  );
};

const getNodeToolMarqueeGeometryNodeIds = (
  editor,
  event,
  fallbackRect = null
) => {
  const marqueeBounds = getMarqueeCanvasBounds(editor, event, fallbackRect);

  if (!marqueeBounds) {
    return null;
  }

  return editor.nodes
    .filter((node) => {
      if (
        !(isEditableCurveNode(node) && editor.isNodeEffectivelyVisible(node.id))
      ) {
        return false;
      }

      const frame = editor.getNodeRenderFrame(node.id);

      return Boolean(
        frame?.bounds && boundsIntersect(frame.bounds, marqueeBounds)
      );
    })
    .map((node) => node.id);
};

const getNodeToolMarqueeNodeIds = (editor, event, fallbackRect = null) => {
  const geometryNodeIds = getNodeToolMarqueeGeometryNodeIds(
    editor,
    event,
    fallbackRect
  );

  if (geometryNodeIds) {
    return getUniqueNodeIds(geometryNodeIds);
  }

  const selectedNodeIds = getNodeIdsFromSelectedTargets(event.selected);
  const candidateNodeIds = selectedNodeIds.flatMap((nodeId) => {
    const node = editor.getNode(nodeId);

    if (isEditableCurveNode(node)) {
      return [nodeId];
    }

    return editor
      .getDescendantLeafNodeIds(nodeId)
      .filter((descendantNodeId) => {
        const descendantNode = editor.getNode(descendantNodeId);

        return (
          editor.isNodeEffectivelyVisible(descendantNodeId) &&
          isEditableCurveNode(descendantNode)
        );
      });
  });

  return getUniqueNodeIds(candidateNodeIds);
};

const getPointerToolMarqueeNodeIds = (editor, event, fallbackRect = null) => {
  const marqueeBounds = getMarqueeCanvasBounds(editor, event, fallbackRect);

  if (!marqueeBounds) {
    return getUniqueNodeIds(
      getNodeIdsFromSelectedTargets(event.selected).map((target) => {
        return editor.getSelectionTargetNodeId(target);
      })
    );
  }

  const targetNodeIds = editor.nodes
    .filter((node) => editor.isNodeEffectivelyVisible(node.id))
    .map((node) => editor.getSelectionTargetNodeId(node.id))
    .filter(Boolean);

  return getUniqueNodeIds(targetNodeIds).filter((nodeId) => {
    const frame =
      editor.getSelectionTransformFrame([nodeId], { includePreview: false }) ||
      editor.getNodeFrame(nodeId);

    return Boolean(frame?.bounds && boundsContain(marqueeBounds, frame.bounds));
  });
};

const selectNodeToolMarqueeNodeIds = (editor, nodeIds) => {
  editor.getState().selectNodes(getUniqueNodeIds(nodeIds));
};

const getMarqueeCandidatePreview = (editor, nodeId) => {
  const node = editor.getNode(nodeId);

  if (!(node && editor.isNodeEffectivelyVisible(node.id))) {
    return null;
  }

  const pathPreview = getNodePathHostPreview(editor, nodeId);
  if (pathPreview) {
    return { ...pathPreview, kind: "path" };
  }

  const frame =
    editor.getSelectionTransformFrame([node.id], { includePreview: false }) ||
    editor.getNodeFrame(node.id);

  if (!frame) {
    return null;
  }

  const rect = getHostRectFromNodeFrame(editor, frame);

  return rect ? { kind: "bounds", nodeId, rect } : null;
};

const MarqueeCandidatePreview = ({ preview }) => {
  if (preview.kind === "path") {
    return (
      <CanvasNodePathPreview
        className="canvas-marquee-candidate-preview"
        preview={preview}
      />
    );
  }

  return (
    <div
      className="canvas-hover-preview canvas-marquee-candidate-preview pointer-events-none absolute"
      data-node-id={preview.nodeId}
      data-preview-kind="bounds"
      style={{
        height: `${preview.rect.height + 2}px`,
        left: `${preview.rect.left - 1}px`,
        top: `${preview.rect.top - 1}px`,
        transform: preview.rect.transform,
        transformOrigin: "center center",
        width: `${preview.rect.width + 2}px`,
      }}
    />
  );
};

const MarqueeCandidatePreviews = ({ nodeIds }) => {
  const editor = useEditor();
  const previews = nodeIds
    .map((nodeId) => getMarqueeCandidatePreview(editor, nodeId))
    .filter(Boolean);

  return previews.map((preview) => {
    return <MarqueeCandidatePreview key={preview.nodeId} preview={preview} />;
  });
};

const canStartObjectMarquee = (activeTool) => {
  return activeTool === "pointer" || activeTool === "node";
};

export const CanvasSelectionMarquee = () => {
  const editor = useEditor();
  const selectoRef = useRef(null);
  const dragStartClientPointRef = useRef(null);
  const dragRectRef = useRef(null);
  const [candidateNodeIds, setCandidateNodeIds] = useState([]);

  const activeTool = useEditorValue((_, state) => state.activeTool);
  const editingNodeId = useEditorValue((_, state) => state.editingNodeId);
  const pathEditingNodeId = useEditorValue(
    (_, state) => state.pathEditingNodeId
  );
  const spacePressed = useEditorValue((_, state) => state.spacePressed);
  const canSelectFromInside = useEditorValue((_, state) => {
    return (
      state.activeTool === "node" &&
      !state.editingNodeId &&
      !state.pathEditingNodeId
    );
  });
  const selectedTargets = useEditorValue((editor, state) => {
    return editor
      .getEffectiveSelectionNodeIds(state.selectedNodeIds)
      .filter((nodeId) => editor.isNodeEffectivelyVisible(nodeId))
      .map((nodeId) => {
        return (
          editor.getNodeTransformElement(nodeId) ||
          editor.getNodeElement(nodeId)
        );
      })
      .filter(Boolean);
  });

  const hostElement = editor.hostRef;
  const keyContainer = typeof window === "undefined" ? undefined : window;
  const suppressHover = () => {
    editor.setHoveringSuppressed(true);
  };
  const restoreHover = () => {
    editor.setHoveringSuppressed(false);
  };
  const clearDragRect = () => {
    dragStartClientPointRef.current = null;
    dragRectRef.current = null;
  };
  const updateDragRect = (event) => {
    const inputEvent = event.inputEvent;
    const start = dragStartClientPointRef.current;

    if (
      !(
        start &&
        typeof inputEvent?.clientX === "number" &&
        typeof inputEvent?.clientY === "number"
      )
    ) {
      return null;
    }

    const current = {
      x: inputEvent.clientX,
      y: inputEvent.clientY,
    };
    const nextRect = {
      bottom: Math.max(start.y, current.y),
      left: Math.min(start.x, current.x),
      right: Math.max(start.x, current.x),
      top: Math.min(start.y, current.y),
    };

    dragRectRef.current = nextRect;
    return nextRect;
  };

  useLayoutEffect(() => {
    selectoRef.current?.setSelectedTargets?.(selectedTargets);
  }, [selectedTargets]);

  return (
    <>
      <Selecto
        boundContainer={hostElement}
        className="canvas-selecto"
        container={hostElement}
        dragContainer={keyContainer}
        hitRate={100}
        keyContainer={keyContainer}
        onDrag={(event) => {
          const dragRect = updateDragRect(event);

          if (
            editor.activeTool !== "node" ||
            editingNodeId ||
            pathEditingNodeId
          ) {
            setCandidateNodeIds([]);
            return;
          }

          setCandidateNodeIds(
            getNodeToolMarqueeNodeIds(editor, event, dragRect)
          );
        }}
        onDragStart={(event) => {
          if (
            spacePressed ||
            editingNodeId ||
            pathEditingNodeId ||
            event.inputEvent.button !== 0 ||
            !canStartObjectMarquee(activeTool) ||
            shouldBlockSelectionStart(event.inputEvent.target) ||
            event.inputEvent.target?.closest?.(".canvas-moveable")
          ) {
            event.stop();
            restoreHover();
            setCandidateNodeIds([]);
            clearDragRect();
            return;
          }

          suppressHover();
          setCandidateNodeIds([]);
          dragStartClientPointRef.current = {
            x: event.inputEvent.clientX,
            y: event.inputEvent.clientY,
          };
          dragRectRef.current = null;
        }}
        onSelect={(event) => {
          if (
            editor.activeTool !== "node" ||
            editingNodeId ||
            pathEditingNodeId
          ) {
            setCandidateNodeIds([]);
            return;
          }

          setCandidateNodeIds(
            getNodeToolMarqueeNodeIds(editor, event, dragRectRef.current)
          );
        }}
        onSelectEnd={(event) => {
          const currentTool = editor.activeTool;

          if (
            !canStartObjectMarquee(currentTool) ||
            editingNodeId ||
            pathEditingNodeId
          ) {
            restoreHover();
            setCandidateNodeIds([]);
            clearDragRect();
            return;
          }

          const nextSelectedNodeIds =
            currentTool === "node"
              ? getNodeToolMarqueeNodeIds(editor, event, dragRectRef.current)
              : getPointerToolMarqueeNodeIds(
                  editor,
                  event,
                  dragRectRef.current
                );

          restoreHover();
          setCandidateNodeIds([]);
          clearDragRect();

          if (currentTool === "node") {
            selectNodeToolMarqueeNodeIds(
              editor,
              event.inputEvent?.shiftKey
                ? [...editor.selectedNodeIds, ...nextSelectedNodeIds]
                : nextSelectedNodeIds
            );
            return;
          }

          if (event.inputEvent?.shiftKey) {
            editor.setSelectedNodes([
              ...editor.selectedNodeIds,
              ...nextSelectedNodeIds,
            ]);
            return;
          }

          editor.setSelectedNodes(nextSelectedNodeIds);
        }}
        preventClickEventOnDrag
        preventClickEventOnDragStart
        ref={selectoRef}
        rootContainer={hostElement}
        selectableTargets={[".canvas-node"]}
        selectByClick={false}
        selectFromInside={canSelectFromInside}
        toggleContinueSelectWithoutDeselect={["shift"]}
      />
      <MarqueeCandidatePreviews nodeIds={candidateNodeIds} />
    </>
  );
};
