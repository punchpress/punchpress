import { useState } from "react";
import { SortableItem, SortableList } from "@/components/ui/sortable-list";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { SettingsDialog } from "../../settings-dialog";
import { useDocumentCommands } from "../document-commands/use-document-commands";
import { MissingFontsExportDialog } from "../missing-fonts-export-dialog";
import { UnsavedDocumentDialog } from "../unsaved-document-dialog";
import { LayerTreeDragGhost } from "./layer-tree-drag-ghost";
import { LayerTreeRow } from "./layer-tree-row";
import { LayersMainMenu } from "./layers-main-menu";
import { getDuplicateRecentDocumentNames } from "./recent-documents";
import { RecentDocumentsMenu } from "./recent-documents-menu";

export const LayersPanel = () => {
  const editor = useEditor();
  const layerNodeIds = useEditorValue((editor) => editor.layerNodeIds);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState(() => new Set());
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
          <span className="font-medium text-[11px] text-[var(--designer-text-muted)]">
            Layers
          </span>
        </div>

        <div className="flex flex-col gap-[0.5px] px-1 pb-1">
          {layerNodeIds.length > 0 ? (
            <SortableList
              items={layerNodeIds}
              onReorder={(orderedIds) =>
                editor.setNodeOrder([...orderedIds].reverse())
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
                  <SortableItem id={nodeId} key={nodeId}>
                    {({
                      dragHandleProps,
                      isDragging,
                      itemStyle,
                      setItemRef,
                    }) => (
                      <LayerTreeRow
                        collapsedGroupIds={collapsedGroupIds}
                        dragHandleProps={dragHandleProps}
                        isDragging={isDragging}
                        itemStyle={itemStyle}
                        nodeId={nodeId}
                        onToggleCollapse={toggleCollapsedGroup}
                        setItemRef={setItemRef}
                      />
                    )}
                  </SortableItem>
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
