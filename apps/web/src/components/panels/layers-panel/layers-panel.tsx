import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { useState } from "react";
import { SortableList } from "@/components/ui/sortable-list";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { usePerformanceRenderCounter } from "../../../performance/use-performance-render-counter";
import { SettingsDialog } from "../../settings-dialog";
import { useDocumentCommands } from "../document-commands/use-document-commands";
import { MissingFontsExportDialog } from "../missing-fonts-export-dialog";
import { UnsavedDocumentDialog } from "../unsaved-document-dialog";
import { LayerTreeDragGhost } from "./layer-tree-drag-ghost";
import { LayerTreeRow } from "./layer-tree-row";
import { LayersMainMenu } from "./layers-main-menu";
import { getDuplicateRecentDocumentNames } from "./recent-documents";
import { RecentDocumentsMenu } from "./recent-documents-menu";

const isContainerLayerNode = (node) => {
  return node?.type === "group" || node?.type === "vector";
};

const getDisplayedChildIds = (editor, parentId = ROOT_PARENT_ID) => {
  return [...editor.getChildNodeIds(parentId)].reverse();
};

const getVisibleLayerNodeIds = (
  editor,
  collapsedGroupIds,
  parentId = ROOT_PARENT_ID
) => {
  return getDisplayedChildIds(editor, parentId).flatMap((nodeId) => {
    const node = editor.getNode(nodeId);

    if (!(isContainerLayerNode(node) && !collapsedGroupIds.has(nodeId))) {
      return [nodeId];
    }

    return [
      nodeId,
      ...getVisibleLayerNodeIds(editor, collapsedGroupIds, nodeId),
    ];
  });
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
  const nextDisplayedSiblingIds = getDisplayedChildIds(editor, parentId).filter(
    (nodeId) => nodeId !== activeId
  );
  const overIndex = nextDisplayedSiblingIds.indexOf(overId);

  if (overIndex < 0) {
    return;
  }

  nextDisplayedSiblingIds.splice(overIndex, 0, activeId);
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

  const activeParentId = activeNode.parentId || ROOT_PARENT_ID;
  const overParentId = overNode.parentId || ROOT_PARENT_ID;

  if (activeParentId !== overParentId) {
    return;
  }

  reorderLayerSiblings(editor, activeId, overId, activeParentId);
};

export const LayersPanel = () => {
  usePerformanceRenderCounter("render.panel.layers");
  const editor = useEditor();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState(() => new Set());
  const layerNodeIds = useEditorValue((editor) => editor.layerNodeIds);
  const visibleLayerNodeIds = useEditorValue((editor) => {
    return getVisibleLayerNodeIds(editor, collapsedGroupIds);
  });
  const {
    clearRecentDocumentsSafely,
    missingFontsExportDialogProps,
    openRecentDocumentSafely,
    recentDocuments,
    runDocumentCommandSafely,
    unsavedDocumentDialogProps,
  } = useDocumentCommands();
  const duplicateRecentDocumentNames =
    getDuplicateRecentDocumentNames(recentDocuments);
  const toggleCollapsedGroup = (nodeId) => {
    setCollapsedGroupIds((currentCollapsedGroupIds) => {
      const nextCollapsedGroupIds = new Set(currentCollapsedGroupIds);

      if (nextCollapsedGroupIds.has(nodeId)) {
        nextCollapsedGroupIds.delete(nodeId);
      } else {
        nextCollapsedGroupIds.add(nodeId);
      }

      return nextCollapsedGroupIds;
    });
  };

  return (
    <>
      <div className="flex flex-col rounded-xl border border-[var(--designer-border)] bg-[var(--designer-surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]">
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

        <div className="mx-2.5 h-px bg-[var(--designer-border)]" />

        <div className="px-3 pt-2.5 pb-1.5">
          <span className="font-semibold text-[12px] text-foreground/70 tracking-[-0.01em]">
            Layers
          </span>
        </div>

        <div className="flex flex-col gap-[0.5px] px-1 pb-1">
          {layerNodeIds.length > 0 ? (
            <SortableList
              items={visibleLayerNodeIds}
              onMove={({ activeId, overId }) =>
                moveLayerNode(editor, activeId, overId)
              }
              renderDragOverlay={(nodeId) => (
                <LayerTreeDragGhost
                  collapsedGroupIds={collapsedGroupIds}
                  nodeId={nodeId}
                />
              )}
            >
              {layerNodeIds.map((nodeId) => {
                return (
                  <LayerTreeRow
                    collapsedGroupIds={collapsedGroupIds}
                    key={nodeId}
                    nodeId={nodeId}
                    onToggleCollapse={toggleCollapsedGroup}
                  />
                );
              })}
            </SortableList>
          ) : (
            <div className="px-2 py-2.5 text-[13px] text-[var(--designer-text-muted)]">
              No layers yet.
            </div>
          )}
        </div>
      </div>

      <SettingsDialog onOpenChange={setIsSettingsOpen} open={isSettingsOpen} />
      <MissingFontsExportDialog {...missingFontsExportDialogProps} />
      <UnsavedDocumentDialog {...unsavedDocumentDialogProps} />
    </>
  );
};
