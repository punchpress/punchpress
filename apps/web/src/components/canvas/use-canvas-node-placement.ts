import { useLayoutEffect, useRef } from "react";
import { useEditor } from "../../editor-react/use-editor";
import { resolvePreviewPlacementNodeIds } from "./canvas-node-preview-placement";

interface NodeShellState {
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
    height: Math.max(1, frame.bounds.height),
    transform: frame.transform || "",
    width: Math.max(1, frame.bounds.width),
    x: frame.bounds.minX,
    y: frame.bounds.minY,
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
    shellState.transform,
    delta?.x || 0,
    delta?.y || 0,
  ].join(":");
};

const applyNodeShellState = (element, shellState, delta) => {
  if (!element) {
    return;
  }

  if (!shellState) {
    element.style.width = "0px";
    element.style.height = "0px";
    element.style.transform = "translate3d(0px, 0px, 0)";
    return;
  }

  const x = shellState.x + (delta?.x || 0);
  const y = shellState.y + (delta?.y || 0);

  element.style.width = `${shellState.width}px`;
  element.style.height = `${shellState.height}px`;
  element.style.transform = shellState.transform
    ? `translate3d(${x}px, ${y}px, 0) ${shellState.transform}`
    : `translate3d(${x}px, ${y}px, 0)`;
};

const syncNodeShell = (editor, nodeId, shellState, appliedKeys, delta) => {
  const element = editor.getNodeElement(nodeId);

  if (!element) {
    appliedKeys.delete(nodeId);
    return;
  }

  const nextKey = getShellKey(shellState, delta);

  if (appliedKeys.get(nodeId) === nextKey) {
    return;
  }

  applyNodeShellState(element, shellState, delta);
  appliedKeys.set(nodeId, nextKey);
};

const applyPreviewTransform = (previewEntry: PreviewEntry, delta) => {
  const { element, shellState, transformSuffix } = previewEntry;

  if (!(element && shellState)) {
    return;
  }

  element.style.transform = `translate3d(${shellState.x + delta.x}px, ${shellState.y + delta.y}px, 0)${transformSuffix}`;
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

const pruneNodeShells = (visibleNodeIds, appliedKeys, shellStates) => {
  for (const nodeId of [...appliedKeys.keys()]) {
    if (!visibleNodeIds.includes(nodeId)) {
      appliedKeys.delete(nodeId);
      shellStates.delete(nodeId);
    }
  }
};

const syncDurableNodeShells = (editor, visibleNodeIds, placementState) => {
  const { appliedKeys, preview, shellStates } = placementState;
  const previewNodeIdSet = new Set(
    resolvePreviewPlacementNodeIds(editor, visibleNodeIds, preview?.nodeIds)
  );

  pruneNodeShells(visibleNodeIds, appliedKeys, shellStates);

  for (const nodeId of visibleNodeIds) {
    const shellState = getNodeShellState(editor, nodeId);
    shellStates.set(nodeId, shellState);

    if (previewNodeIdSet.has(nodeId)) {
      continue;
    }

    syncNodeShell(editor, nodeId, shellState, appliedKeys);
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
    applyPreviewTransform(entry, preview.delta);
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
      const { appliedKeys, shellStates } = placementStateRef.current;

      for (const nodeId of [...shellStates.keys()]) {
        if (!nodeIds.includes(nodeId)) {
          shellStates.delete(nodeId);
          appliedKeys.delete(nodeId);
        }
      }

      for (const nodeId of nodeIds) {
        const shellState = getNodeShellState(editor, nodeId);
        shellStates.set(nodeId, shellState);
        syncNodeShell(editor, nodeId, shellState, appliedKeys);
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [editor, nodeIds]);
};
