import { ViewIcon, ViewOffIcon } from "@hugeicons-pro/core-stroke-rounded";
import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { NodeContextMenuItems } from "@/components/context-menus/node-context-menu-items";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { SortableItem } from "@/components/ui/sortable-list";
import { cn } from "@/lib/utils";
import { getCompoundVectorOperationTarget } from "@/lib/vector-compound-operation";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { usePerformanceRenderCounter } from "../../../performance/use-performance-render-counter";
import { LayerCompoundOperationMenu } from "./layer-compound-operation-menu";
import { LayerGlyph } from "./layer-glyph";
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

const getContourTone = (contour) => {
  return contour.closed ? "closed" : "open";
};

const getFocusParentId = (parentId) => {
  return parentId !== ROOT_PARENT_ID ? parentId : null;
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
  showCompoundOperationMenu,
}) => {
  const iconClassName = cn(
    getLayerNodeIconClassName({
      isSelected: layer.isSelected,
      isVisible: layer.isVisible,
    })
  );

  if (isContainer && isRenaming) {
    return (
      <div className={primaryButtonClassName}>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span aria-hidden="true" className={iconClassName}>
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

  if (!showCompoundOperationMenu) {
    return (
      <button
        aria-label={layer.label}
        aria-pressed={layer.isSelected}
        className={primaryButtonClassName}
        data-layer-node-id={layer.node.id}
        onClick={onSelect}
        onDoubleClick={onDoubleClick}
        type="button"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span aria-hidden="true" className={iconClassName}>
            <LayerNodeIcon isGroup={layer.isGroup} nodeType={layer.node.type} />
          </span>
          <span className={labelClassName}>{layer.label}</span>
        </span>
      </button>
    );
  }

  return (
    <div className={primaryButtonClassName}>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <LayerCompoundOperationMenu
          className={iconClassName}
          label={layer.label}
          nodeId={layer.node.id}
          nodeType={layer.node.type}
          onSelect={onSelect}
        />
        <button
          aria-label={layer.label}
          aria-pressed={layer.isSelected}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left text-inherit shadow-none outline-none"
          data-layer-node-id={layer.node.id}
          onClick={onSelect}
          onDoubleClick={onDoubleClick}
          type="button"
        >
          <span className={labelClassName}>{layer.label}</span>
        </button>
      </span>
    </div>
  );
};

const LayerTreeChildren = ({
  childNodeIds,
  collapsedGroupIds,
  contourRows,
  depth,
  isExpanded,
  isContainer,
  onToggleCollapse,
}) => {
  if (
    !(
      isContainer &&
      isExpanded &&
      (childNodeIds.length > 0 || contourRows.length > 0)
    )
  ) {
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

      {contourRows.map((contourRow) => {
        return (
          <LayerContourRow
            depth={depth + 1}
            isSelected={contourRow.isSelected}
            key={contourRow.id}
            label={contourRow.label}
            onSelect={contourRow.onSelect}
            tone={contourRow.tone}
          />
        );
      })}
    </div>
  );
};

const LayerContourRow = ({ depth, isSelected, label, onSelect, tone }) => {
  return (
    <div
      className="flex w-full items-stretch"
      style={{
        paddingLeft: `${depth * LAYER_TREE_INDENT}px`,
      }}
    >
      <span className="w-[34px]" />
      <button
        className={cn(
          "flex h-auto min-w-0 flex-1 items-center justify-between gap-2 rounded-[8px] border-0 bg-transparent px-2 py-1.5 text-left text-[0.8125rem] shadow-none outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
          isSelected
            ? "bg-blue-600 text-white"
            : "text-foreground/72 hover:bg-[var(--designer-hover)]"
        )}
        onClick={onSelect}
        type="button"
      >
        <span className="min-w-0 truncate whitespace-nowrap">{label}</span>
        <span
          className={cn(
            "shrink-0 text-[0.6875rem] uppercase tracking-[0.08em]",
            isSelected ? "text-white/80" : "text-foreground/40"
          )}
        >
          {tone}
        </span>
      </button>
      <span className="w-8" />
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
  const vectorContours = useEditorValue((editor) => {
    const node = editor.getNode(nodeId);

    return node?.type === "vector" ? node.contours || [] : [];
  });
  const compoundOperationTarget = useEditorValue((nextEditor) => {
    const target = getCompoundVectorOperationTarget(nextEditor, nodeId);

    return target?.nodeId === nodeId ? target : null;
  });
  const pathEditingState = useEditorValue((_, state) => ({
    pathEditingNodeId: state.pathEditingNodeId,
    pathEditingPoint: state.pathEditingPoint,
  }));

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
  const isExpanded = !collapsedGroupIds.has(nodeId);
  const isHovered = hoveredNodeId === nodeId;
  const contourRows =
    layer.node.type === "vector" &&
    childNodeIds.length === 0 &&
    vectorContours.length > 1
      ? vectorContours.map((contour, contourIndex) => ({
          id: `${nodeId}:contour:${contourIndex}`,
          isSelected:
            pathEditingState.pathEditingNodeId === nodeId &&
            pathEditingState.pathEditingPoint?.contourIndex === contourIndex,
          label: `Contour ${contourIndex + 1}`,
          onSelect: () => {
            editor.select(nodeId);
            editor.startPathEditing(nodeId);

            if (contour.segments.length > 0) {
              editor.setPathEditingPoint({
                contourIndex,
                segmentIndex: 0,
              });
            }
          },
          tone: getContourTone(contour),
        }))
      : [];
  const VisibilityIcon = layer.isVisible ? ViewIcon : ViewOffIcon;
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

  const handleSelect = (event = { shiftKey: false }) => {
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
          <ContextMenu>
            <ContextMenuTrigger
              className="block w-full"
              onContextMenuCapture={() => {
                if (!layer.isSelected) {
                  handleSelect({ shiftKey: false });
                }
              }}
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
                data-layer-row-id={nodeId}
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
                  showCompoundOperationMenu={Boolean(compoundOperationTarget)}
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
            </ContextMenuTrigger>

            <NodeContextMenuItems
              nodeId={nodeId}
              onStartRenaming={startRenaming}
            />
          </ContextMenu>

          <LayerTreeChildren
            childNodeIds={childNodeIds}
            collapsedGroupIds={collapsedGroupIds}
            contourRows={contourRows}
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
