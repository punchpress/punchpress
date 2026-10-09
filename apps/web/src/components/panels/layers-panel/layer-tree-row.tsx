import { ViewIcon, ViewOffIcon } from "@hugeicons-pro/core-stroke-rounded";
import { PERF_COUNTERS, PERF_SPANS } from "@punchpress/engine";
import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { memo } from "react";
import { NodeContextMenuItems } from "@/components/context-menus/node-context-menu-items";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { SortableItem } from "@/components/ui/sortable-list";
import { cn } from "@/lib/utils";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { usePerformanceRenderCounter } from "../../../performance/use-performance-render-counter";
import { LayerGlyph } from "./layer-glyph";
import { LayerRowPrimary } from "./layer-row-primary";
import { LayerTreeRowParts } from "./layer-tree-row-parts";
import { useLayerRename } from "./use-layer-rename";

const DENSE_LAYER_CHILD_COUNT = 300;

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

  if (
    editor.getNodeEditCapabilities(nodeId)?.requiresPathEditing &&
    editor.startPathEditing(nodeId)
  ) {
    editor.setActiveTool("node");
  }
};

// One flat row of the virtualized layers list. The panel owns row order and
// depth; children render as their own rows.
export const LayerTreeRow = memo(function LayerTreeRow({
  collapsedGroupIds,
  depth = 0,
  expandedDenseGroupIds,
  nodeId,
  onToggleCollapse,
  sortable = true,
}) {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelLayerRow);
  const editor = useEditor();
  const layer = useEditorValue(
    (editor) => editor.getLayerRow(nodeId),
    PERF_SPANS.layerRowSelectorLayer
  );
  const { childCount, isHovered } = useEditorValue((editor, state) => {
    return {
      childCount: editor.getChildNodeIds(nodeId).length,
      isHovered: state.hoveredNodeId === nodeId,
    };
  }, PERF_SPANS.layerRowSelectorState);
  const rename = useLayerRename(nodeId, layer?.label);

  if (!layer) {
    return null;
  }

  const isDenseContainer = childCount > DENSE_LAYER_CHILD_COUNT;
  const isExpanded =
    !collapsedGroupIds.has(nodeId) &&
    (!isDenseContainer || expandedDenseGroupIds.has(nodeId));
  const VisibilityIcon = layer.isVisible ? ViewIcon : ViewOffIcon;
  const focusParentId = getFocusParentId(layer.node.parentId);
  const isHighlighted = layer.isSelected || layer.isActive;
  let rowState: "hovered" | "idle" | "selected" = "idle";

  if (isHighlighted) {
    rowState = "selected";
  } else if (isHovered) {
    rowState = "hovered";
  }

  const handleSelect = (event = { shiftKey: false }) => {
    editor.setFocusedGroup(focusParentId);

    if (event.shiftKey) {
      editor.toggleSelection(nodeId);
      return;
    }

    if (layer.node.type === "path" && editor.activeTool === "node") {
      if (editor.startPathEditing(nodeId)) {
        editor.setActiveTool("node");
      }
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
      isContainer: layer.isContainer,
      isSelected: layer.isSelected,
      node: layer.node,
      nodeId,
      selectedCount: editor.selectedNodeIds.length,
    });
  };

  const renderRow = ({
    dragHandleProps = {},
    isDragging = false,
    itemStyle = undefined,
    setItemRef = undefined,
  } = {}) => {
    return (
      <div
        className={cn("w-full", isDragging && "z-20 opacity-35")}
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
            <LayerTreeRowParts.Root
              data-active-layer={layer.isActive ? "true" : undefined}
              data-layer-row-id={nodeId}
              depth={depth}
              muted={!layer.isVisible}
              state={rowState}
              {...(rename.isRenaming ? {} : dragHandleProps)}
            >
              {layer.isContainer ? (
                <LayerTreeRowParts.Disclosure
                  expanded={isExpanded}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleCollapse(nodeId, {
                      defaultCollapsed: isDenseContainer,
                    });
                  }}
                />
              ) : (
                <LayerTreeRowParts.Spacer />
              )}

              <LayerRowPrimary
                layer={layer}
                onDoubleClick={handleDoubleClick}
                onSelect={handleSelect}
                rename={rename}
              />

              <LayerTreeRowParts.Action
                aria-label={layer.visibilityLabel}
                onClick={(event) => {
                  event.stopPropagation();
                  editor.toggleVisibility(nodeId);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                pinned={!layer.isVisible}
              >
                <LayerGlyph icon={VisibilityIcon} strokeWidth={1.8} />
              </LayerTreeRowParts.Action>
            </LayerTreeRowParts.Root>
          </ContextMenuTrigger>

          <NodeContextMenuItems
            nodeId={nodeId}
            onStartRenaming={rename.start}
          />
        </ContextMenu>
      </div>
    );
  };

  return sortable ? (
    <SortableItem id={nodeId}>
      {({ dragHandleProps, isDragging, itemStyle, setItemRef }) =>
        renderRow({ dragHandleProps, isDragging, itemStyle, setItemRef })
      }
    </SortableItem>
  ) : (
    renderRow()
  );
});
