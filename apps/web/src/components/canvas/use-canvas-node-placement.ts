import { useLayoutEffect, useRef } from "react";
import { useEditor } from "../../editor-react/use-editor";
import { getArtboardClipPath } from "./artboard-clip-path";
import { resolvePreviewPlacementNodeIds } from "./canvas-node-preview-placement";

interface NodeShellState {
  clipPath: string;
  height: number;
  stationaryClipAncestorId: string | null;
  transform: string;
  transformOrigin: string;
  width: number;
  x: number;
  y: number;
}

interface PreviewEntry {
  nodeId: string;
  shellElement: HTMLElement;
  shellState: NodeShellState;
  transformElement: HTMLElement;
}

interface PlacementElements {
  shellElement: HTMLElement;
  transformElement: HTMLElement;
}

const getNodeShellState = (editor, nodeId): NodeShellState | null => {
  const node = editor.getNode(nodeId);
  const frame = editor.getNodeRenderFrame(nodeId);

  if (!(frame && node)) {
    return null;
  }
  const writableBounds = editor.getRasterWritableBounds(nodeId);
  const presentationBounds = writableBounds
    ? {
        height: writableBounds.height,
        maxX: writableBounds.x + writableBounds.width,
        maxY: writableBounds.y + writableBounds.height,
        minX: writableBounds.x,
        minY: writableBounds.y,
        width: writableBounds.width,
      }
    : null;
  const bounds = presentationBounds
    ? {
        height: presentationBounds.height,
        maxX: (node.transform?.x || 0) + presentationBounds.maxX,
        maxY: (node.transform?.y || 0) + presentationBounds.maxY,
        minX: (node.transform?.x || 0) + presentationBounds.minX,
        minY: (node.transform?.y || 0) + presentationBounds.minY,
        width: presentationBounds.width,
      }
    : frame.bounds;
  const transformOrigin = presentationBounds
    ? `${node.width / 2 - presentationBounds.minX}px ${
        node.height / 2 - presentationBounds.minY
      }px`
    : "center center";
  const parentNode = editor.getNode(node.parentId);

  return {
    clipPath: getArtboardClipPath(editor, nodeId, bounds),
    height: Math.max(1, bounds.height),
    stationaryClipAncestorId:
      presentationBounds && parentNode?.type === "artboard"
        ? parentNode.id
        : null,
    transform: frame.transform || "",
    transformOrigin,
    width: Math.max(1, bounds.width),
    x: bounds.minX,
    y: bounds.minY,
  };
};

const getShellKey = (shellState, delta) => {
  if (!shellState) {
    return "null";
  }

  return [
    shellState.width,
    shellState.height,
    shellState.x,
    shellState.y,
    shellState.stationaryClipAncestorId,
    shellState.transform,
    shellState.transformOrigin,
    shellState.clipPath,
    delta?.x || 0,
    delta?.y || 0,
  ].join(":");
};

const getResizePreviewBounds = (shellState, preview) => {
  const resize = preview?.resize;

  if (!(shellState && resize)) {
    return null;
  }

  if (resize.frame?.bounds) {
    return resize.frame.bounds;
  }

  const scale = Number.isFinite(resize.scale) ? resize.scale : 1;
  const anchor = resize.anchorCanvas;

  if (!anchor) {
    return null;
  }

  const minX = anchor.x + (shellState.x - anchor.x) * scale;
  const minY = anchor.y + (shellState.y - anchor.y) * scale;
  const width = Math.max(1, shellState.width * scale);
  const height = Math.max(1, shellState.height * scale);

  return {
    height,
    maxX: minX + width,
    maxY: minY + height,
    minX,
    minY,
    width,
  };
};

const getRotatePreviewTransform = (previewBounds, preview) => {
  const rotate = preview?.rotate;

  if (!(previewBounds && rotate?.centerCanvas)) {
    return null;
  }

  const deltaRotation = Number.isFinite(rotate.deltaRotation)
    ? rotate.deltaRotation
    : 0;

  return {
    originX: rotate.centerCanvas.x - previewBounds.minX,
    originY: rotate.centerCanvas.y - previewBounds.minY,
    rotation: deltaRotation,
  };
};

const getPlacementElements = (editor, nodeId): PlacementElements | null => {
  const transformElement = editor.getNodeElement(nodeId);

  if (!transformElement) {
    return null;
  }

  const shellElement =
    transformElement.parentElement instanceof HTMLElement &&
    transformElement.parentElement.dataset.nodeShell === "true"
      ? transformElement.parentElement
      : transformElement;

  return {
    shellElement,
    transformElement,
  };
};

const applyNodeShellState = (
  elements: PlacementElements | null,
  shellState,
  delta
) => {
  if (!elements) {
    return;
  }

  const { shellElement, transformElement } = elements;

  if (!shellState) {
    shellElement.style.clipPath = "";
    shellElement.style.width = "0px";
    shellElement.style.height = "0px";
    shellElement.style.transform = "translate3d(0px, 0px, 0)";
    shellElement.style.transformOrigin = "";
    shellElement.style.willChange = "";
    transformElement.style.transform = "";
    transformElement.style.transformOrigin = "";
    return;
  }

  const x = shellState.x + (delta?.x || 0);
  const y = shellState.y + (delta?.y || 0);

  shellElement.style.width = `${shellState.width}px`;
  shellElement.style.height = `${shellState.height}px`;
  shellElement.style.clipPath = shellState.clipPath;
  shellElement.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  shellElement.style.transformOrigin = "";
  shellElement.style.willChange = "";
  transformElement.style.transform = shellState.transform || "";
  transformElement.style.transformOrigin = shellState.transformOrigin;
};

const syncNodeShell = (
  editor,
  nodeId,
  shellState,
  appliedElements,
  appliedKeys,
  delta
) => {
  const elements = getPlacementElements(editor, nodeId);

  if (!elements) {
    appliedElements.delete(nodeId);
    appliedKeys.delete(nodeId);
    return;
  }

  const nextKey = getShellKey(shellState, delta);
  const previousElements = appliedElements.get(nodeId);

  if (
    appliedKeys.get(nodeId) === nextKey &&
    previousElements?.shellElement === elements.shellElement &&
    previousElements?.transformElement === elements.transformElement
  ) {
    return;
  }

  applyNodeShellState(elements, shellState, delta);
  appliedElements.set(nodeId, elements);
  appliedKeys.set(nodeId, nextKey);
};

const applyPreviewTransform = (editor, previewEntry: PreviewEntry, preview) => {
  const { shellElement, shellState, transformElement } = previewEntry;

  if (!(shellElement && transformElement && shellState)) {
    return;
  }

  const delta = preview.delta || { x: 0, y: 0 };
  const resizeBounds = getResizePreviewBounds(shellState, preview);
  const resizeFrame = preview?.resize?.frame || null;
  const previewBounds = resizeBounds || {
    height: shellState.height,
    maxX: shellState.x + shellState.width + (delta.x || 0),
    maxY: shellState.y + shellState.height + (delta.y || 0),
    minX: shellState.x + (delta.x || 0),
    minY: shellState.y + (delta.y || 0),
    width: shellState.width,
  };
  const rotateTransform = getRotatePreviewTransform(previewBounds, preview);

  if (
    shellState.stationaryClipAncestorId &&
    !preview.nodeIds?.includes(shellState.stationaryClipAncestorId) &&
    !(resizeBounds || rotateTransform)
  ) {
    shellElement.style.clipPath = shellState.clipPath;
    shellElement.style.width = `${shellState.width}px`;
    shellElement.style.height = `${shellState.height}px`;
    shellElement.style.willChange = "";
    shellElement.style.transformOrigin = "";
    shellElement.style.transform = `translate3d(${shellState.x}px, ${shellState.y}px, 0)`;
    transformElement.style.transform =
      `translate3d(${delta.x || 0}px, ${delta.y || 0}px, 0) ${shellState.transform}`.trim();
    transformElement.style.transformOrigin = shellState.transformOrigin;
    return;
  }

  shellElement.style.clipPath = getArtboardClipPath(
    editor,
    previewEntry.nodeId,
    previewBounds,
    preview
  );
  shellElement.style.width = `${previewBounds.width}px`;
  shellElement.style.height = `${previewBounds.height}px`;
  shellElement.style.willChange = "transform";
  shellElement.style.transformOrigin = rotateTransform
    ? `${rotateTransform.originX}px ${rotateTransform.originY}px`
    : "";
  shellElement.style.transform = rotateTransform
    ? `translate3d(${previewBounds.minX}px, ${previewBounds.minY}px, 0) rotate(${rotateTransform.rotation}deg)`
    : `translate3d(${previewBounds.minX}px, ${previewBounds.minY}px, 0)`;
  transformElement.style.transform =
    resizeFrame?.transform || shellState.transform || "";
  transformElement.style.transformOrigin = shellState.transformOrigin;
};

const sameNodeIds = (left = [], right = []) => {
  return (
    left.length === right.length &&
    left.every((nodeId, index) => {
      return nodeId === right[index];
    })
  );
};

const canReusePreviewEntries = (preview, nodeIds) => {
  if (!(preview && sameNodeIds(preview.nodeIds, nodeIds))) {
    return false;
  }

  if (preview.entries.length !== nodeIds.length) {
    return false;
  }

  return preview.entries.every((entry) => {
    return (
      entry.shellElement?.isConnected && entry.transformElement?.isConnected
    );
  });
};

const pruneNodeShells = (
  visibleNodeIds,
  appliedElements,
  appliedKeys,
  shellStates
) => {
  for (const nodeId of [...appliedKeys.keys()]) {
    if (!visibleNodeIds.includes(nodeId)) {
      appliedElements.delete(nodeId);
      appliedKeys.delete(nodeId);
      shellStates.delete(nodeId);
    }
  }
};

const syncDurableNodeShells = (editor, visibleNodeIds, placementState) => {
  const { appliedElements, appliedKeys, preview, shellStates } = placementState;
  const previewNodeIdSet = new Set(
    resolvePreviewPlacementNodeIds(editor, visibleNodeIds, preview)
  );

  pruneNodeShells(visibleNodeIds, appliedElements, appliedKeys, shellStates);

  for (const nodeId of visibleNodeIds) {
    const shellState = getNodeShellState(editor, nodeId);
    shellStates.set(nodeId, shellState);

    if (previewNodeIdSet.has(nodeId)) {
      continue;
    }

    syncNodeShell(editor, nodeId, shellState, appliedElements, appliedKeys);
  }
};

const getPreviewBaseShellStates = (editor, placementState, nodeIds) => {
  if (canReusePreviewEntries(placementState.preview, nodeIds)) {
    return placementState.preview?.entries || null;
  }

  const entries: PreviewEntry[] = [];

  for (const nodeId of nodeIds) {
    const shellState =
      placementState.shellStates.get(nodeId) ||
      getNodeShellState(editor, nodeId);
    const elements = getPlacementElements(editor, nodeId);

    if (elements && shellState) {
      entries.push({
        nodeId,
        shellElement: elements.shellElement,
        shellState,
        transformElement: elements.transformElement,
      });
    }
  }

  placementState.preview = {
    entries,
    lastDeltaKey: null,
    nodeIds: [...nodeIds],
  };

  return entries;
};

const syncPreviewNodeShells = (editor, placementState, preview) => {
  if (
    !(
      preview?.nodeIds?.length &&
      (preview.delta || preview.resize || preview.rotate)
    )
  ) {
    placementState.preview = null;
    return false;
  }

  const previewPlacementNodeIds = resolvePreviewPlacementNodeIds(
    editor,
    [...placementState.shellStates.keys()],
    preview
  );

  if (previewPlacementNodeIds.length === 0) {
    placementState.preview = null;
    return false;
  }

  const entries = getPreviewBaseShellStates(
    editor,
    placementState,
    previewPlacementNodeIds
  );
  const delta = preview.delta || { x: 0, y: 0 };
  let deltaKey = `move:${delta.x}:${delta.y}`;

  if (preview.resize) {
    const frame = preview.resize.frame;
    deltaKey = frame
      ? `resize-frame:${frame.bounds?.minX}:${frame.bounds?.minY}:${frame.bounds?.width}:${frame.bounds?.height}:${frame.transform || ""}`
      : `resize:${preview.resize.anchorCanvas?.x}:${preview.resize.anchorCanvas?.y}:${preview.resize.scale}`;
  } else if (preview.rotate) {
    deltaKey = `rotate:${preview.rotate.centerCanvas?.x}:${preview.rotate.centerCanvas?.y}:${preview.rotate.deltaRotation}`;
  }

  if (!(entries && placementState.preview)) {
    return true;
  }

  if (placementState.preview.lastDeltaKey === deltaKey) {
    return true;
  }

  for (const entry of entries) {
    applyPreviewTransform(editor, entry, preview);
    placementState.appliedElements.set(entry.nodeId, {
      shellElement: entry.shellElement,
      transformElement: entry.transformElement,
    });
    placementState.appliedKeys.set(entry.nodeId, `preview:${deltaKey}`);
  }

  placementState.preview.lastDeltaKey = deltaKey;

  return true;
};

export const useCanvasNodePlacement = (nodeIds) => {
  const editor = useEditor();
  const nodeIdsRef = useRef(nodeIds);
  const placementStateRef = useRef({
    appliedElements: new Map(),
    appliedKeys: new Map(),
    preview: null,
    shellStates: new Map(),
  });

  nodeIdsRef.current = nodeIds;

  useLayoutEffect(() => {
    let frameId = 0;
    let isDisposed = false;
    let isScheduled = false;

    const syncDurablePlacement = () => {
      isScheduled = false;

      if (isDisposed) {
        return;
      }

      syncDurableNodeShells(
        editor,
        nodeIdsRef.current,
        placementStateRef.current
      );
      editor.notifyPlacementSurfaceApplied();
    };

    const syncPreviewPlacement = () => {
      if (isDisposed) {
        return;
      }

      const preview = editor.selectionDragPreview;
      const didSyncPreview = syncPreviewNodeShells(
        editor,
        placementStateRef.current,
        preview
      );

      if (!didSyncPreview) {
        syncDurablePlacement();
      }
    };

    const scheduleDurableSync = () => {
      if (isDisposed || isScheduled) {
        return;
      }

      isScheduled = true;
      frameId = window.requestAnimationFrame(syncDurablePlacement);
    };

    syncDurablePlacement();
    syncPreviewPlacement();

    const unsubscribeStore = editor.store.subscribe(scheduleDurableSync);
    const unsubscribePreview =
      editor.subscribeSelectionDragPreview(syncPreviewPlacement);

    return () => {
      isDisposed = true;
      window.cancelAnimationFrame(frameId);
      unsubscribePreview();
      unsubscribeStore();
    };
  }, [editor]);

  useLayoutEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const { appliedElements, appliedKeys, shellStates } =
        placementStateRef.current;

      for (const nodeId of [...shellStates.keys()]) {
        if (!nodeIds.includes(nodeId)) {
          appliedElements.delete(nodeId);
          shellStates.delete(nodeId);
          appliedKeys.delete(nodeId);
        }
      }

      for (const nodeId of nodeIds) {
        const shellState = getNodeShellState(editor, nodeId);
        shellStates.set(nodeId, shellState);
        syncNodeShell(editor, nodeId, shellState, appliedElements, appliedKeys);
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [editor, nodeIds]);
};
