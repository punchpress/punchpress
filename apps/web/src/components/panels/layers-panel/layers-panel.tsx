import {
  getPathNodeContours,
  PERF_COUNTERS,
  PERF_SPANS,
} from "@punchpress/engine";
import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { PlusIcon } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SortableList } from "@/components/ui/sortable-list";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { usePerformanceRenderCounter } from "../../../performance/use-performance-render-counter";
import { SettingsDialog } from "../../settings-dialog";
import { LayerTreeDragGhost } from "./layer-tree-drag-ghost";
import { LayerContourRow, LayerTreeRow } from "./layer-tree-row";
import { LayersMainMenu } from "./layers-main-menu";
import { getDuplicateRecentDocumentNames } from "./recent-documents";
import { RecentDocumentsMenu } from "./recent-documents-menu";

const isContainerLayerNode = (node) => {
  return (
    node?.type === "artboard" ||
    node?.type === "group" ||
    node?.type === "vector"
  );
};

const LAYER_ROW_HEIGHT = 32;
const LAYER_ROW_OVERSCAN = 8;
const LAYER_EMPTY_STATE_HEIGHT = 42;
const LAYER_LIST_VERTICAL_PADDING = 4;
const LAYERS_PANEL_CHROME_HEIGHT = 82;
const LAYERS_PANEL_LIST_MAX_HEIGHT = `calc(100vh - var(--desktop-chrome-height, 0px) - var(--desktop-panel-top-gap, 16px) - 16px - ${LAYERS_PANEL_CHROME_HEIGHT}px)`;

const getDisplayedChildIds = (editor, parentId = ROOT_PARENT_ID) => {
  return [...editor.getChildNodeIds(parentId)].reverse();
};

const getEditableContourCount = (node) => {
  return getLayerEditableContours(node).length;
};

const getLayerEditableContours = (node) => {
  if (node?.type === "path") {
    return getPathNodeContours(node);
  }

  if (node?.type === "vector") {
    return node.contours || [];
  }

  return [];
};

const getLayerContourRows = (editor, nodeId, depth) => {
  const node = editor.getNode(nodeId);
  const childNodeIds = editor.getChildNodeIds(nodeId);
  const contourCount = getEditableContourCount(node);

  if (
    !(
      isContainerLayerNode(node) &&
      childNodeIds.length === 0 &&
      contourCount > 1
    )
  ) {
    return [];
  }

  return Array.from({ length: contourCount }, (_, index) => ({
    contourIndex: index,
    depth,
    kind: "contour",
    nodeId,
  }));
};

const getVisibleLayerRowKeys = (
  editor,
  collapsedGroupIds,
  expandedDenseGroupIds,
  parentId = ROOT_PARENT_ID,
  depth = 0
) => {
  return getDisplayedChildIds(editor, parentId).flatMap((nodeId) => {
    const node = editor.getNode(nodeId);
    const childNodeIds = editor.getChildNodeIds(nodeId);
    const isDenseContainer = childNodeIds.length > 300;

    if (
      !(
        isContainerLayerNode(node) &&
        !collapsedGroupIds.has(nodeId) &&
        (!isDenseContainer || expandedDenseGroupIds.has(nodeId))
      )
    ) {
      return [{ depth, kind: "node", nodeId }];
    }

    return [
      { depth, kind: "node", nodeId },
      ...getLayerContourRows(editor, nodeId, depth + 1),
      ...getVisibleLayerRowKeys(
        editor,
        collapsedGroupIds,
        expandedDenseGroupIds,
        nodeId,
        depth + 1
      ),
    ];
  });
};

const getVirtualLayerRange = (scrollTop, viewportHeight, rowCount) => {
  const visibleStartIndex = Math.floor(scrollTop / LAYER_ROW_HEIGHT);
  const visibleRowCount = Math.ceil(viewportHeight / LAYER_ROW_HEIGHT);
  const startIndex = Math.max(0, visibleStartIndex - LAYER_ROW_OVERSCAN);
  const endIndex = Math.min(
    rowCount,
    visibleStartIndex + visibleRowCount + LAYER_ROW_OVERSCAN
  );

  return { endIndex, startIndex };
};

const setDisplayedNodeOrder = (
  editor,
  displayedNodeIds,
  parentId = ROOT_PARENT_ID
) => {
  const orderedNodeIds = [...displayedNodeIds].reverse();

  if (parentId === ROOT_PARENT_ID) {
    editor.setNodeOrder(orderedNodeIds);
    return;
  }

  editor.setNodeOrder(orderedNodeIds, parentId);
};

const movePathLayerNode = (editor, activeId, overNode) => {
  if (overNode.type === "vector") {
    editor.moveNodeToParent(activeId, overNode.id, null);
    return true;
  }

  const targetParentId = overNode.parentId || ROOT_PARENT_ID;
  const targetParentNode =
    targetParentId === ROOT_PARENT_ID ? null : editor.getNode(targetParentId);

  if (targetParentNode?.type !== "vector") {
    return false;
  }

  const displayedTargetChildIds = getDisplayedChildIds(
    editor,
    targetParentId
  ).filter((nodeId) => nodeId !== activeId);
  const overIndex = displayedTargetChildIds.indexOf(overNode.id);

  if (overIndex < 0) {
    return false;
  }

  const beforeNodeId =
    overIndex > 0 ? displayedTargetChildIds[overIndex - 1] : null;

  editor.moveNodeToParent(activeId, targetParentId, beforeNodeId);

  return true;
};

const reorderLayerSiblings = (editor, activeId, overId, parentId) => {
  const displayedSiblingIds = getDisplayedChildIds(editor, parentId);
  const activeIndex = displayedSiblingIds.indexOf(activeId);
  const overIndex = displayedSiblingIds.indexOf(overId);

  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return;
  }

  const nextDisplayedSiblingIds = [...displayedSiblingIds];
  const [movedNodeId] = nextDisplayedSiblingIds.splice(activeIndex, 1);

  if (!movedNodeId) {
    return;
  }

  nextDisplayedSiblingIds.splice(overIndex, 0, movedNodeId);
  setDisplayedNodeOrder(editor, nextDisplayedSiblingIds, parentId);
};

const moveLayerNode = (editor, activeId, overId) => {
  const activeNode = editor.getNode(activeId);
  const overNode = editor.getNode(overId);

  if (!(activeNode && overNode) || activeId === overId) {
    return;
  }

  if (editor.isDescendantOf(overId, activeId)) {
    return;
  }

  if (
    activeNode.type === "path" &&
    movePathLayerNode(editor, activeId, overNode)
  ) {
    return;
  }

  if (overNode.type === "artboard" && activeNode.type !== "artboard") {
    editor.moveNodeToParent(activeId, overNode.id, null);
    return;
  }

  const activeParentId = activeNode.parentId || ROOT_PARENT_ID;
  const overParentId = overNode.parentId || ROOT_PARENT_ID;

  if (activeParentId !== overParentId) {
    return;
  }

  reorderLayerSiblings(editor, activeId, overId, activeParentId);
};

const getLayerListHeight = (visibleLayerCount, hasLayers) => {
  if (!hasLayers) {
    return LAYER_EMPTY_STATE_HEIGHT;
  }

  return visibleLayerCount * LAYER_ROW_HEIGHT + LAYER_LIST_VERTICAL_PADDING;
};

export const LayersPanel = ({ documentCommands }) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelLayers);
  const editor = useEditor();
  const scrollViewportRef = useRef(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLayerPointerInside, setIsLayerPointerInside] = useState(false);
  const [isLayerReorderActive, setIsLayerReorderActive] = useState(false);
  const [layerScrollTop, setLayerScrollTop] = useState(0);
  const [layerViewportHeight, setLayerViewportHeight] = useState(0);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState(() => new Set());
  const [expandedDenseGroupIds, setExpandedDenseGroupIds] = useState(
    () => new Set()
  );
  const layerNodeIds = useEditorValue(
    (editor) => editor.layerNodeIds,
    PERF_SPANS.layersSelectorNodeIds
  );
  const isCanvasSelectionDragging = useEditorValue((_, state) => {
    return state.isSelectionDragging;
  }, PERF_SPANS.layersSelectorDragging);
  const visibleLayerRowKeys = useEditorValue((editor) => {
    return getVisibleLayerRowKeys(
      editor,
      collapsedGroupIds,
      expandedDenseGroupIds
    );
  }, PERF_SPANS.layersSelectorVisibleNodeIds);
  const visibleLayerRows = useMemo(
    () => visibleLayerRowKeys,
    [visibleLayerRowKeys]
  );
  const {
    clearRecentDocumentsSafely,
    openRecentDocumentSafely,
    recentDocuments,
    runDocumentCommandSafely,
  } = documentCommands;
  const duplicateRecentDocumentNames =
    getDuplicateRecentDocumentNames(recentDocuments);
  const layerListHeight = getLayerListHeight(
    visibleLayerRows.length,
    layerNodeIds.length > 0
  );
  const isLayerSortingEnabled =
    !isCanvasSelectionDragging &&
    (isLayerPointerInside || isLayerReorderActive);
  const toggleCollapsedGroup = useCallback((nodeId, options = {}) => {
    if (options.defaultCollapsed) {
      setExpandedDenseGroupIds((currentExpandedGroupIds) => {
        const nextExpandedGroupIds = new Set(currentExpandedGroupIds);

        if (nextExpandedGroupIds.has(nodeId)) {
          nextExpandedGroupIds.delete(nodeId);
        } else {
          nextExpandedGroupIds.add(nodeId);
        }

        return nextExpandedGroupIds;
      });
      return;
    }

    setCollapsedGroupIds((currentCollapsedGroupIds) => {
      const nextCollapsedGroupIds = new Set(currentCollapsedGroupIds);

      if (nextCollapsedGroupIds.has(nodeId)) {
        nextCollapsedGroupIds.delete(nodeId);
      } else {
        nextCollapsedGroupIds.add(nodeId);
      }

      return nextCollapsedGroupIds;
    });
  }, []);
  const { endIndex, startIndex } = getVirtualLayerRange(
    layerScrollTop,
    layerViewportHeight,
    visibleLayerRows.length
  );
  const renderedLayerRows = visibleLayerRows.slice(startIndex, endIndex);
  const isRenderedLayerSortingEnabled =
    isLayerSortingEnabled &&
    renderedLayerRows.every((row) => row.kind === "node");
  const renderedLayerNodeIds = renderedLayerRows
    .filter((row) => row.kind === "node")
    .map((row) => row.nodeId);
  const virtualTopPadding = startIndex * LAYER_ROW_HEIGHT;
  const virtualBottomPadding = Math.max(
    0,
    (visibleLayerRows.length - endIndex) * LAYER_ROW_HEIGHT
  );
  const layerRows = renderedLayerRows.map((row) => {
    if (row.kind === "contour") {
      const node = editor.getNode(row.nodeId);
      const contours = getLayerEditableContours(node);
      const contour = contours[row.contourIndex];
      const isSelected =
        editor.pathEditingNodeId === row.nodeId &&
        editor.pathEditingPoint?.contourIndex === row.contourIndex;

      return (
        <LayerContourRow
          depth={row.depth}
          isSelected={isSelected}
          key={`${row.nodeId}:contour:${row.contourIndex}`}
          label={`Contour ${row.contourIndex + 1}`}
          onSelect={() => {
            editor.select(row.nodeId);
            if (editor.startPathEditing(row.nodeId)) {
              editor.setActiveTool("node");
            }

            if (contour?.segments.length > 0) {
              editor.setPathEditingPoint({
                contourIndex: row.contourIndex,
                segmentIndex: 0,
              });
            }
          }}
          tone={contour?.closed ? "closed" : "open"}
        />
      );
    }

    return (
      <LayerTreeRow
        collapsedGroupIds={collapsedGroupIds}
        depth={row.depth}
        expandedDenseGroupIds={expandedDenseGroupIds}
        key={row.nodeId}
        nodeId={row.nodeId}
        onToggleCollapse={toggleCollapsedGroup}
        renderChildren={false}
        sortable={isRenderedLayerSortingEnabled}
      />
    );
  });

  useLayoutEffect(() => {
    const viewportElement = scrollViewportRef.current;

    if (!viewportElement) {
      return;
    }

    const updateViewportHeight = () => {
      setLayerViewportHeight(viewportElement.clientHeight);
    };

    updateViewportHeight();

    const resizeObserver = new ResizeObserver(updateViewportHeight);
    resizeObserver.observe(viewportElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);
  let layerListContent = (
    <div className="px-2 py-2.5 text-[13px] text-[var(--designer-text-muted)]">
      No layers yet.
    </div>
  );

  if (layerNodeIds.length > 0) {
    layerListContent = isRenderedLayerSortingEnabled ? (
      <SortableList
        items={renderedLayerNodeIds}
        onMove={({ activeId, overId }) =>
          moveLayerNode(editor, activeId, overId)
        }
        onReorderEnd={() => setIsLayerReorderActive(false)}
        onReorderStart={() => setIsLayerReorderActive(true)}
        renderDragOverlay={(nodeId) => (
          <LayerTreeDragGhost
            collapsedGroupIds={collapsedGroupIds}
            nodeId={nodeId}
          />
        )}
      >
        {layerRows}
      </SortableList>
    ) : (
      layerRows
    );
  }

  return (
    <>
      <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--designer-border)] bg-[var(--designer-surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-2 px-2.5 pt-2.5 pb-1.5">
          <LayersMainMenu
            onOpenSettings={setIsSettingsOpen}
            runDocumentCommandSafely={runDocumentCommandSafely}
          >
            <RecentDocumentsMenu
              clearRecentDocumentsSafely={clearRecentDocumentsSafely}
              duplicateRecentDocumentNames={duplicateRecentDocumentNames}
              openRecentDocumentSafely={openRecentDocumentSafely}
              recentDocuments={recentDocuments}
            />
          </LayersMainMenu>
        </div>

        <div className="mx-2.5 h-px bg-foreground/4" />

        <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
          <span className="font-semibold text-[12px] text-foreground/70 tracking-[-0.01em]">
            Layers
          </span>
          <Button
            aria-label="New layer"
            onClick={() => editor.addEmptyLayer()}
            size="icon-sm"
            title="New layer"
            type="button"
            variant="ghost"
          >
            <PlusIcon size={15} strokeWidth={2} />
          </Button>
        </div>

        <ScrollArea
          className="min-h-0"
          onPointerEnter={() => setIsLayerPointerInside(true)}
          onPointerLeave={() => setIsLayerPointerInside(false)}
          onViewportScroll={(event) => {
            setLayerScrollTop(event.currentTarget.scrollTop);
          }}
          scrollbarGutter
          scrollFade
          style={{
            height: `${layerListHeight}px`,
            maxHeight: LAYERS_PANEL_LIST_MAX_HEIGHT,
          }}
          viewportRef={scrollViewportRef}
        >
          <div className="flex flex-col gap-[0.5px] px-1 pb-1">
            {virtualTopPadding > 0 ? (
              <div style={{ height: `${virtualTopPadding}px` }} />
            ) : null}
            {layerListContent}
            {virtualBottomPadding > 0 ? (
              <div style={{ height: `${virtualBottomPadding}px` }} />
            ) : null}
          </div>
        </ScrollArea>
      </div>

      <SettingsDialog onOpenChange={setIsSettingsOpen} open={isSettingsOpen} />
    </>
  );
};
