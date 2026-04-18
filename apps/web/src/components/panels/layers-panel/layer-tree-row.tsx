import { ContextMenu } from "@base-ui/react/context-menu";
import {
  Copy01Icon,
  Delete02Icon,
  Edit01Icon,
  GroupLayersIcon,
  LayerBringToFrontIcon,
  LayerSendToBackIcon,
  UngroupLayersIcon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons-pro/core-stroke-rounded";
import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { MenuShortcut } from "@/components/ui/menu";
import { SortableItem } from "@/components/ui/sortable-list";
import { cn } from "@/lib/utils";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { usePerformanceRenderCounter } from "../../../performance/use-performance-render-counter";
import {
  LAYER_SHORTCUTS,
  LayerContextMenuItem,
  LayerContextMenuPopup,
  LayerContextMenuSeparator,
  LayerGlyph,
} from "./layer-context-menu";
import { LayerNodeIcon } from "./layer-node-icon";

const LAYER_TREE_INDENT = 24;

const getLayerPrimaryButtonClassName = ({ isSelected }) => {
  return cn(
    "h-auto min-w-0 flex-1 appearance-none justify-start gap-2 border-0 bg-transparent px-2 py-1.5 text-left text-[0.8125rem] text-inherit shadow-none outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
    isSelected && "text-white"
  );
};

const getLayerVisibilityButtonClassName = ({ isSelected, isVisible }) => {
  return cn(
    "h-auto shrink-0 border-0 bg-transparent px-2 text-foreground/42 shadow-none",
    !isVisible && "text-foreground/30 opacity-100",
    isSelected && "text-white/72"
  );
};

const getLayerNodeIconClassName = ({ isSelected, isVisible }) => {
  return cn(
    "inline-flex shrink-0 items-center justify-center text-foreground/58",
    !isVisible && "text-foreground/34",
    isSelected && "text-white/78"
  );
};

const getLayerLabelClassName = ({ isSelected, isVisible }) => {
  return cn(
    "min-w-0 truncate whitespace-nowrap font-[450]",
    !(isVisible || isSelected) && "text-foreground/55"
  );
};

const getLayerDisclosureClassName = ({ isSelected }) => {
  return cn(
    "inline-flex shrink-0 items-center justify-center pr-0.5 pl-2 text-foreground/50",
    isSelected && "text-white/72"
  );
};

const getLayerVisibilityIconClassName = ({ isSelected, isVisible }) => {
  return cn(
    "inline-flex shrink-0 items-center justify-center",
    isVisible ? "text-inherit" : "text-inherit/90",
    isSelected && "text-inherit"
  );
};

const getLayerRowClassName = ({ isHovered, isSelected }) => {
  if (isSelected) {
    return "bg-blue-600 text-white";
  }

  if (isHovered) {
    return "bg-[var(--designer-hover)]";
  }

  return "bg-transparent";
};

const getFocusParentId = (parentId) => {
  return parentId !== ROOT_PARENT_ID ? parentId : null;
};

const getCanGroupSelection = (editor, selectedNodeIds) => {
  return (
    selectedNodeIds.length > 1 &&
    new Set(
      selectedNodeIds
        .map(
          (selectedNodeId) =>
            editor.getNode(selectedNodeId)?.parentId || ROOT_PARENT_ID
        )
        .filter(Boolean)
    ).size === 1
  );
};

const handleLayerDoubleClick = ({
  editor,
  isContainer,
  isSelected,
  node,
  nodeId,
  selectedCount,
}) => {
  if (isContainer) {
    if (!(isSelected && selectedCount === 1)) {
      editor.select(nodeId);
      return;
    }

    editor.setFocusedGroup(nodeId);
    editor.clearSelectionPreservingFocus();
    return;
  }

  editor.setFocusedGroup(getFocusParentId(node.parentId));

  if (editor.getNodeEditCapabilities(nodeId)?.canEditText) {
    editor.startEditing(node);
    return;
  }

  if (editor.getNodeEditCapabilities(nodeId)?.requiresPathEditing) {
    editor.startPathEditing(nodeId);
  }
};

const LayerRowPrimaryControl = ({
  isContainer,
  isRenaming,
  layer,
  labelClassName,
  onChangeRenameValue,
  onCommitRename,
  onDoubleClick,
  onSelect,
  onCancelRename,
  primaryButtonClassName,
  renameInputRef,
  renameValue,
}) => {
  if (isContainer && isRenaming) {
    return (
      <div className={primaryButtonClassName}>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              getLayerNodeIconClassName({
                isSelected: layer.isSelected,
                isVisible: layer.isVisible,
              })
            )}
          >
            <LayerNodeIcon isGroup={layer.isGroup} nodeType={layer.node.type} />
          </span>
          <input
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-inherit/45"
            onBlur={onCommitRename}
            onChange={(event) => onChangeRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onCommitRename();
              }

              if (event.key === "Escape") {
                onCancelRename();
              }
            }}
            onPointerDown={(event) => event.stopPropagation()}
            ref={renameInputRef}
            value={renameValue}
          />
        </span>
      </div>
    );
  }

  return (
    <button
      aria-pressed={layer.isSelected}
      className={primaryButtonClassName}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      type="button"
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            getLayerNodeIconClassName({
              isSelected: layer.isSelected,
              isVisible: layer.isVisible,
            })
          )}
        >
          <LayerNodeIcon isGroup={layer.isGroup} nodeType={layer.node.type} />
        </span>
        <span className={labelClassName}>{layer.label}</span>
      </span>
    </button>
  );
};

const GroupLayerContextMenuItems = ({
  canGroupSelection,
  canUngroup,
  editor,
  nodeId,
  onStartRenaming,
}) => {
  if (!(canGroupSelection || canUngroup)) {
    return null;
  }

  return (
    <>
      {canGroupSelection && (
        <LayerContextMenuItem onClick={() => editor.groupSelected()}>
          <LayerGlyph icon={GroupLayersIcon} size={17} strokeWidth={1.7} />
          Group selection
          <MenuShortcut>{LAYER_SHORTCUTS.group}</MenuShortcut>
        </LayerContextMenuItem>
      )}
      {canUngroup && (
        <>
          <LayerContextMenuItem onClick={onStartRenaming}>
            <LayerGlyph icon={Edit01Icon} size={17} strokeWidth={1.7} />
            Rename group…
          </LayerContextMenuItem>
          <LayerContextMenuItem onClick={() => editor.ungroup(nodeId)}>
            <LayerGlyph icon={UngroupLayersIcon} size={17} strokeWidth={1.7} />
            Ungroup
            <MenuShortcut>{LAYER_SHORTCUTS.ungroup}</MenuShortcut>
          </LayerContextMenuItem>
        </>
      )}
      <LayerContextMenuSeparator />
    </>
  );
};

const LayerTreeChildren = ({
  childNodeIds,
  collapsedGroupIds,
  depth,
  isExpanded,
  isContainer,
  onToggleCollapse,
}) => {
  if (!(isContainer && isExpanded && childNodeIds.length > 0)) {
    return null;
  }

  const orderedChildNodeIds = [...childNodeIds].reverse();

  return (
    <div className="flex flex-col">
      {orderedChildNodeIds.map((childNodeId) => {
        return (
          <LayerTreeRow
            collapsedGroupIds={collapsedGroupIds}
            depth={depth + 1}
            key={childNodeId}
            nodeId={childNodeId}
            onToggleCollapse={onToggleCollapse}
          />
        );
      })}
    </div>
  );
};

export const LayerTreeRow = ({
  collapsedGroupIds,
  depth = 0,
  nodeId,
  onToggleCollapse,
}) => {
  usePerformanceRenderCounter("render.panel.layer-row");
  const editor = useEditor();
  const renameInputRef = useRef(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const hoveredNodeId = useEditorValue((_, state) => state.hoveredNodeId);
  const selectedCount = useEditorValue(
    (_, state) => state.selectedNodeIds.length
  );
  const layer = useEditorValue((editor) => editor.getLayerRow(nodeId));
  const childNodeIds = useEditorValue((editor) =>
    editor.getChildNodeIds(nodeId)
  );
  const selectedNodeIds = useEditorValue((_, state) => state.selectedNodeIds);

  useLayoutEffect(() => {
    if (!layer) {
      return;
    }

    if (!isRenaming) {
      setRenameValue(layer.label);
      return;
    }

    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [isRenaming, layer]);

  if (!layer) {
    return null;
  }

  const isContainer = layer.isContainer;
  const isGroup = layer.isGroup;
  const isExpanded = !collapsedGroupIds.has(nodeId);
  const isHovered = hoveredNodeId === nodeId;
  const VisibilityIcon = layer.isVisible ? ViewIcon : ViewOffIcon;
  const canGroupSelection = getCanGroupSelection(editor, selectedNodeIds);
  const canUngroup = isGroup;
  const focusParentId = getFocusParentId(layer.node.parentId);
  const primaryButtonClassName = getLayerPrimaryButtonClassName({
    isSelected: layer.isSelected,
  });
  const visibilityButtonClassName = getLayerVisibilityButtonClassName({
    isSelected: layer.isSelected,
    isVisible: layer.isVisible,
  });
  const labelClassName = getLayerLabelClassName({
    isSelected: layer.isSelected,
    isVisible: layer.isVisible,
  });

  const handleSelect = (event) => {
    editor.setFocusedGroup(focusParentId);

    if (event.shiftKey) {
      editor.toggleSelection(nodeId);
      return;
    }

    if (layer.node.type === "path" && editor.pathEditingNodeId) {
      editor.startPathEditing(nodeId);
      return;
    }

    editor.select(nodeId);
  };

  const handleDoubleClick = () => {
    handleLayerDoubleClick({
      editor,
      isContainer,
      isSelected: layer.isSelected,
      node: layer.node,
      nodeId,
      selectedCount,
    });
  };

  const startRenaming = () => {
    window.requestAnimationFrame(() => {
      setIsRenaming(true);
    });
  };

  const commitRename = () => {
    editor.renameGroup(nodeId, renameValue);
    setIsRenaming(false);
  };

  const cancelRename = () => {
    setRenameValue(layer.label);
    setIsRenaming(false);
  };

  return (
    <SortableItem id={nodeId}>
      {({ dragHandleProps, isDragging, itemStyle, setItemRef }) => (
        <div
          className={cn(
            "flex w-full flex-col",
            isDragging && "z-20 opacity-35"
          )}
          ref={setItemRef}
          style={itemStyle}
        >
          <ContextMenu.Root>
            <ContextMenu.Trigger
              className="block w-full"
              onContextMenuCapture={() => handleSelect({ shiftKey: false })}
              onPointerEnter={() => editor.setHoveredNode(nodeId)}
              onPointerLeave={() => {
                if (editor.hoveredNodeId !== nodeId) {
                  return;
                }

                editor.setHoveredNode(null);
              }}
            >
              <div
                className={cn(
                  "group box-border flex w-full items-stretch gap-0 overflow-hidden rounded-[8px]",
                  getLayerRowClassName({
                    isHovered,
                    isSelected: layer.isSelected,
                  })
                )}
                {...(isRenaming ? {} : dragHandleProps)}
                style={{
                  paddingLeft: `${depth * LAYER_TREE_INDENT}px`,
                }}
              >
                {isContainer ? (
                  <button
                    aria-label={
                      isExpanded ? "Collapse container" : "Expand container"
                    }
                    className={getLayerDisclosureClassName({
                      isSelected: layer.isSelected,
                    })}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleCollapse(nodeId);
                    }}
                    type="button"
                  >
                    {isExpanded ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </button>
                ) : null}

                <LayerRowPrimaryControl
                  isContainer={isContainer}
                  isRenaming={isRenaming}
                  labelClassName={labelClassName}
                  layer={layer}
                  onCancelRename={cancelRename}
                  onChangeRenameValue={setRenameValue}
                  onCommitRename={commitRename}
                  onDoubleClick={handleDoubleClick}
                  onSelect={handleSelect}
                  primaryButtonClassName={primaryButtonClassName}
                  renameInputRef={renameInputRef}
                  renameValue={renameValue}
                />

                <button
                  aria-label={layer.visibilityLabel}
                  className={visibilityButtonClassName}
                  onClick={(event) => {
                    event.stopPropagation();
                    editor.toggleVisibility(nodeId);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  tabIndex={-1}
                  type="button"
                >
                  <span
                    className={getLayerVisibilityIconClassName({
                      isSelected: layer.isSelected,
                      isVisible: layer.isVisible,
                    })}
                  >
                    <LayerGlyph
                      icon={VisibilityIcon}
                      size={16}
                      strokeWidth={1.8}
                    />
                  </span>
                </button>
              </div>
            </ContextMenu.Trigger>

            <LayerContextMenuPopup>
              <GroupLayerContextMenuItems
                canGroupSelection={canGroupSelection}
                canUngroup={canUngroup}
                editor={editor}
                nodeId={nodeId}
                onStartRenaming={startRenaming}
              />

              <LayerContextMenuItem onClick={() => editor.duplicate(nodeId)}>
                <LayerGlyph icon={Copy01Icon} size={17} strokeWidth={1.7} />
                Duplicate
                <MenuShortcut>{LAYER_SHORTCUTS.duplicate}</MenuShortcut>
              </LayerContextMenuItem>
              <LayerContextMenuItem
                onClick={() => editor.toggleVisibility(nodeId)}
              >
                <LayerGlyph
                  icon={layer.isVisible ? ViewOffIcon : ViewIcon}
                  size={17}
                  strokeWidth={1.7}
                />
                {layer.visibilityLabel}
              </LayerContextMenuItem>
              <LayerContextMenuSeparator />
              <LayerContextMenuItem
                disabled={selectedCount <= 1 && layer.isFrontmost}
                onClick={() => editor.bringToFront(nodeId)}
              >
                <LayerGlyph
                  icon={LayerBringToFrontIcon}
                  size={17}
                  strokeWidth={1.7}
                />
                Bring to front
                <MenuShortcut>{LAYER_SHORTCUTS.bringToFront}</MenuShortcut>
              </LayerContextMenuItem>
              <LayerContextMenuItem
                disabled={selectedCount <= 1 && layer.isBackmost}
                onClick={() => editor.sendToBack(nodeId)}
              >
                <LayerGlyph
                  icon={LayerSendToBackIcon}
                  size={17}
                  strokeWidth={1.7}
                />
                Send to back
                <MenuShortcut>{LAYER_SHORTCUTS.sendToBack}</MenuShortcut>
              </LayerContextMenuItem>
              <LayerContextMenuSeparator />
              <LayerContextMenuItem
                className="text-destructive-foreground data-highlighted:bg-destructive/10 data-highlighted:text-destructive-foreground"
                onClick={() => editor.deleteNode(nodeId)}
              >
                <LayerGlyph icon={Delete02Icon} size={17} strokeWidth={1.7} />
                Delete
              </LayerContextMenuItem>
            </LayerContextMenuPopup>
          </ContextMenu.Root>

          <LayerTreeChildren
            childNodeIds={childNodeIds}
            collapsedGroupIds={collapsedGroupIds}
            depth={depth}
            isContainer={isContainer}
            isExpanded={isExpanded}
            onToggleCollapse={onToggleCollapse}
          />
        </div>
      )}
    </SortableItem>
  );
};
