import { useLayoutEffect, useRef } from "react";
import { useEditor } from "../../editor-react/use-editor";
import { resolvePreviewPlacementNodeIds } from "./canvas-node-preview-placement";

interface NodeShellState {
  clipPath: string;
  height: number;
  transform: string;
  width: number;
  x: number;
  y: number;
}

interface PreviewEntry {
  element: HTMLElement;
  nodeId: string;
  shellState: NodeShellState;
  transformSuffix: string;
}

const getNodeShellState = (editor, nodeId): NodeShellState | null => {
  const frame = editor.getNodeRenderFrame(nodeId);
  const node = editor.getNode(nodeId);

  if (!(frame && node)) {
    return null;
  }

  return {
    clipPath: getNodeClipPath(editor, nodeId, frame.bounds),
    height: Math.max(1, frame.bounds.height),
    transform: frame.transform || "",
    width: Math.max(1, frame.bounds.width),
    x: frame.bounds.minX,
    y: frame.bounds.minY,
  };
};

const offsetBounds = (bounds, delta) => {
  if (!(bounds && delta)) {
    return bounds;
  }

  return {
    ...bounds,
    maxX: bounds.maxX + (delta.x || 0),
    maxY: bounds.maxY + (delta.y || 0),
    minX: bounds.minX + (delta.x || 0),
    minY: bounds.minY + (delta.y || 0),
  };
};

const getNodeClipPath = (editor, nodeId, bounds, preview = null) => {
  const node = editor.getNode(nodeId);
  const parentNode =
    node?.parentId && node.parentId !== "root"
      ? editor.getNode(node.parentId)
      : null;

  if (!(bounds && parentNode?.type === "artboard")) {
    return "";
  }

  const artboardFrame = editor.getNodeRenderFrame(parentNode.id);
  const artboardBounds = preview?.nodeIds?.includes(parentNode.id)
    ? offsetBounds(artboardFrame?.bounds, preview.delta)
    : artboardFrame?.bounds;

  if (!artboardBounds) {
    return "";
  }

  const top = Math.max(0, artboardBounds.minY - bounds.minY);
  const right = Math.max(0, bounds.maxX - artboardBounds.maxX);
  const bottom = Math.max(0, bounds.maxY - artboardBounds.maxY);
  const left = Math.max(0, artboardBounds.minX - bounds.minX);

  return `inset(${top}px ${right}px ${bottom}px ${left}px)`;
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
    shellState.transform,
    shellState.clipPath,
    delta?.x || 0,
    delta?.y || 0,
  ].join(":");
};

const applyNodeShellState = (element, shellState, delta) => {
  if (!element) {
    return;
  }

  if (!shellState) {
    element.style.clipPath = "";
    element.style.width = "0px";
    element.style.height = "0px";
    element.style.transform = "translate3d(0px, 0px, 0)";
    return;
  }

  const x = shellState.x + (delta?.x || 0);
  const y = shellState.y + (delta?.y || 0);

  element.style.width = `${shellState.width}px`;
  element.style.height = `${shellState.height}px`;
  element.style.clipPath = shellState.clipPath;
  element.style.transform = shellState.transform
    ? `translate3d(${x}px, ${y}px, 0) ${shellState.transform}`
    : `translate3d(${x}px, ${y}px, 0)`;
};

const syncNodeShell = (
  editor,
  nodeId,
  shellState,
  appliedElements,
  appliedKeys,
  delta
) => {
  const element = editor.getNodeElement(nodeId);

  if (!element) {
    appliedElements.delete(nodeId);
    appliedKeys.delete(nodeId);
    return;
  }

  const nextKey = getShellKey(shellState, delta);
  const previousElement = appliedElements.get(nodeId);

  if (appliedKeys.get(nodeId) === nextKey && previousElement === element) {
    return;
  }

  applyNodeShellState(element, shellState, delta);
  appliedElements.set(nodeId, element);
  appliedKeys.set(nodeId, nextKey);
};

const applyPreviewTransform = (editor, previewEntry: PreviewEntry, preview) => {
  const { element, shellState, transformSuffix } = previewEntry;

  if (!(element && shellState)) {
    return;
  }

  const delta = preview.delta || { x: 0, y: 0 };
  const previewBounds = {
    height: shellState.height,
    maxX: shellState.x + shellState.width + (delta.x || 0),
    maxY: shellState.y + shellState.height + (delta.y || 0),
    minX: shellState.x + (delta.x || 0),
    minY: shellState.y + (delta.y || 0),
    width: shellState.width,
  };

  element.style.clipPath = getNodeClipPath(
    editor,
    previewEntry.nodeId,
    previewBounds,
    preview
  );
  element.style.transform = `translate3d(${previewBounds.minX}px, ${previewBounds.minY}px, 0)${transformSuffix}`;
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
    return entry.element?.isConnected;
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
    resolvePreviewPlacementNodeIds(editor, visibleNodeIds, preview?.nodeIds)
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
    const element = editor.getNodeElement(nodeId);

    if (element && shellState) {
      entries.push({
        element,
        nodeId,
        shellState,
        transformSuffix: shellState.transform ? ` ${shellState.transform}` : "",
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
  if (!(preview?.nodeIds?.length && preview.delta)) {
    placementState.preview = null;
    return false;
  }

  const previewPlacementNodeIds = resolvePreviewPlacementNodeIds(
    editor,
    [...placementState.shellStates.keys()],
    preview.nodeIds
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
  const deltaKey = `${preview.delta.x}:${preview.delta.y}`;

  if (!(entries && placementState.preview)) {
    return true;
  }

  if (placementState.preview.lastDeltaKey === deltaKey) {
    return true;
  }

  for (const entry of entries) {
    applyPreviewTransform(editor, entry, preview);
    placementState.appliedElements.set(entry.nodeId, entry.element);
    placementState.appliedKeys.set(
      entry.nodeId,
      getShellKey(entry.shellState, preview.delta)
    );
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
      editor.subscribeInteractionPreview(syncPreviewPlacement);

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
