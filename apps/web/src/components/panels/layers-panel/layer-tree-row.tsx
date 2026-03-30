import { ContextMenu } from "@base-ui/react/context-menu";
import {
  Copy01Icon,
  Delete02Icon,
  Edit01Icon,
  GroupLayersIcon,
  LayerBringToFrontIcon,
  LayerSendToBackIcon,
  TextFontIcon,
  UngroupLayersIcon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons-pro/core-stroke-rounded";
import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { MenuShortcut } from "@/components/ui/menu";
import { SortableItem, SortableList } from "@/components/ui/sortable-list";
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
import { LayerTreeDragGhost } from "./layer-tree-drag-ghost";

const LAYER_TREE_INDENT = 24;

const getLayerPrimaryButtonClassName = ({ isSelected }) => {
  return cn(
    "h-auto min-w-0 flex-1 appearance-none justify-start gap-2 border-0 bg-transparent px-2 py-1.5 text-left text-[13px] text-inherit shadow-none outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
    isSelected && "text-white"
  );
};

const getLayerVisibilityButtonClassName = ({ isSelected, isVisible }) => {
  return cn(
    "h-auto shrink-0 border-0 bg-transparent px-2 text-foreground/34 shadow-none",
    !isVisible && "text-foreground/60 opacity-100",
    isSelected && "text-white/65"
  );
};

const getLayerLabelClassName = ({ isSelected, isVisible }) => {
  return cn(
    "min-w-0 truncate whitespace-nowrap font-[450]",
    !(isVisible || isSelected) && "text-foreground/55"
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
  isGroup,
  isSelected,
  node,
  nodeId,
  selectedCount,
}) => {
  if (isGroup) {
    if (!(isSelected && selectedCount === 1)) {
      editor.select(nodeId);
      return;
    }

    editor.setFocusedGroup(nodeId);
    editor.clearSelectionPreservingFocus();
    return;
  }

  editor.setFocusedGroup(getFocusParentId(node.parentId));
  editor.startEditing(node);
};

const useSortableDragStyle = ({ isDragging, itemStyle, setItemRef }) => {
  const itemElementRef = useRef(null);
  const [dragSize, setDragSize] = useState(null);

  useLayoutEffect(() => {
    if (!(isDragging && itemElementRef.current)) {
      setDragSize(null);
      return;
    }

    const rect = itemElementRef.current.getBoundingClientRect();
    setDragSize({
      height: rect.height,
      width: rect.width,
    });
  }, [isDragging]);

  return {
    handleSetItemRef: (element) => {
      itemElementRef.current = element;
      setItemRef?.(element);
    },
    sortableItemStyle: {
      ...itemStyle,
      ...(isDragging && dragSize
        ? {
            height: `${dragSize.height}px`,
            width: `${dragSize.width}px`,
          }
        : null),
    },
  };
};

const LayerRowPrimaryControl = ({
  isGroup,
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
  if (isGroup && isRenaming) {
    return (
      <div className={primaryButtonClassName}>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex shrink-0 items-center justify-center",
              layer.isSelected ? "text-white/70" : "text-foreground/35"
            )}
          >
            <Folder size={15} strokeWidth={1.8} />
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
            "inline-flex shrink-0 items-center justify-center",
            layer.isSelected ? "text-white/70" : "text-foreground/35"
          )}
        >
          {isGroup ? (
            <Folder size={15} strokeWidth={1.8} />
          ) : (
            <LayerGlyph icon={TextFontIcon} size={16} strokeWidth={1.7} />
          )}
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
  isGroup,
  nodeId,
  onToggleCollapse,
}) => {
  const editor = useEditor();

  if (!(isGroup && isExpanded && childNodeIds.length > 0)) {
    return null;
  }

  const orderedChildNodeIds = [...childNodeIds].reverse();

  return (
    <div className="flex flex-col">
      <SortableList
        items={orderedChildNodeIds}
        onReorder={(orderedIds) =>
          editor.setNodeOrder([...orderedIds].reverse(), nodeId)
        }
        renderDragOverlay={(activeNodeId) => (
          <LayerTreeDragGhost
            collapsedGroupIds={collapsedGroupIds}
            depth={depth + 1}
            nodeId={activeNodeId}
          />
        )}
      >
        {orderedChildNodeIds.map((childNodeId) => {
          return (
            <SortableItem id={childNodeId} key={childNodeId}>
              {({ dragHandleProps, isDragging, itemStyle, setItemRef }) => (
                <LayerTreeRow
                  collapsedGroupIds={collapsedGroupIds}
                  depth={depth + 1}
                  dragHandleProps={dragHandleProps}
                  isDragging={isDragging}
                  itemStyle={itemStyle}
                  nodeId={childNodeId}
                  onToggleCollapse={onToggleCollapse}
                  setItemRef={setItemRef}
                />
              )}
            </SortableItem>
          );
        })}
      </SortableList>
    </div>
  );
};

export const LayerTreeRow = ({
  collapsedGroupIds,
  depth = 0,
  dragHandleProps,
  isDragging = false,
  itemStyle,
  nodeId,
  onToggleCollapse,
  setItemRef,
}) => {
  usePerformanceRenderCounter("render.panel.layer-row");
  const editor = useEditor();
  const renameInputRef = useRef(null);
  const { handleSetItemRef, sortableItemStyle } = useSortableDragStyle({
    isDragging,
    itemStyle,
    setItemRef,
  });
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

    editor.select(nodeId);
  };

  const handleDoubleClick = () => {
    handleLayerDoubleClick({
      editor,
      isGroup,
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
    <div
      className={cn("flex w-full flex-col", isDragging && "z-20 opacity-35")}
      ref={handleSetItemRef}
      style={sortableItemStyle}
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
            {isGroup ? (
              <button
                aria-label={isExpanded ? "Collapse group" : "Expand group"}
                className={cn(
                  "inline-flex shrink-0 items-center justify-center pr-0.5 pl-2 text-foreground/45",
                  layer.isSelected && "text-white/70"
                )}
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
              isGroup={isGroup}
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
              <LayerGlyph icon={VisibilityIcon} size={16} strokeWidth={1.8} />
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
          <LayerContextMenuItem onClick={() => editor.toggleVisibility(nodeId)}>
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
        isExpanded={isExpanded}
        isGroup={isGroup}
        nodeId={nodeId}
        onToggleCollapse={onToggleCollapse}
      />
    </div>
  );
};
