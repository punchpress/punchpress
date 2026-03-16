import { ContextMenu } from "@base-ui/react/context-menu";
import {
  Copy01Icon,
  Delete02Icon,
  LayerBringToFrontIcon,
  LayerSendToBackIcon,
  TextFontIcon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons/core-free-icons";
import { MenuShortcut } from "@/components/ui/menu";
import { SortableItem } from "@/components/ui/sortable-list";
import { cn } from "@/lib/utils";
import { useEditor } from "../../../editor/use-editor";
import { useEditorValue } from "../../../editor/use-editor-value";
import {
  LAYER_SHORTCUTS,
  LayerContextMenuItem,
  LayerContextMenuPopup,
  LayerContextMenuSeparator,
  LayerGlyph,
} from "./layer-context-menu";

const getLayerPrimaryButtonClassName = ({
  isSelected,
  joinWithNext,
  joinWithPrevious,
}) => {
  return cn(
    "h-auto min-w-0 flex-1 appearance-none justify-start gap-2 rounded-r-none border-0 bg-transparent px-2 py-1.5 text-left text-[13px] text-inherit shadow-none outline-none ring-0 transition-[box-shadow,opacity] hover:bg-[var(--designer-hover)] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
    joinWithPrevious ? "rounded-tl-none" : "rounded-tl-[8px]",
    joinWithNext ? "rounded-bl-none" : "rounded-bl-[8px]",
    !isSelected && "group-hover:bg-[var(--designer-hover)]",
    isSelected && "bg-blue-600 text-white hover:bg-blue-600 hover:text-white"
  );
};

const getLayerVisibilityButtonClassName = ({
  isSelected,
  isVisible,
  joinWithNext,
  joinWithPrevious,
}) => {
  return cn(
    "h-auto shrink-0 rounded-l-none border-0 bg-transparent px-2 text-foreground/34 shadow-none hover:bg-[var(--designer-hover)] hover:text-foreground/70",
    joinWithPrevious ? "rounded-tr-none" : "rounded-tr-[8px]",
    joinWithNext ? "rounded-br-none" : "rounded-br-[8px]",
    isVisible && !isSelected && "opacity-0 group-hover:opacity-100",
    !isSelected && "group-hover:bg-[var(--designer-hover)]",
    !isVisible && "text-foreground/60 opacity-100",
    isSelected && "bg-blue-600 text-white/65 hover:bg-blue-600 hover:text-white"
  );
};

const getLayerGlyphClassName = ({ isSelected, isVisible }) => {
  return cn(
    "inline-flex shrink-0 cursor-grab items-center justify-center text-foreground/35 active:cursor-grabbing",
    !(isVisible || isSelected) && "text-foreground/22",
    isSelected && "text-white/70"
  );
};

const getLayerLabelClassName = ({ isSelected, isVisible }) => {
  return cn(
    "min-w-0 cursor-grab truncate whitespace-nowrap font-[450] active:cursor-grabbing",
    !(isVisible || isSelected) && "text-foreground/55"
  );
};

export const SortableLayerRow = ({ nodeId, previousNodeId, nextNodeId }) => {
  const editor = useEditor();
  const hoveredNodeId = useEditorValue((_, state) => state.hoveredNodeId);
  const layer = useEditorValue((editor) => editor.getLayerRow(nodeId));
  const previousLayer = useEditorValue((editor) => {
    return previousNodeId ? editor.getLayerRow(previousNodeId) : null;
  });
  const nextLayer = useEditorValue((editor) => {
    return nextNodeId ? editor.getLayerRow(nextNodeId) : null;
  });
  const selectedCount = useEditorValue((editor) => {
    return editor.isSelected(nodeId) ? editor.selectedNodeIds.length : 1;
  });

  if (!layer) {
    return null;
  }

  const VisibilityIcon = layer.isVisible ? ViewIcon : ViewOffIcon;
  const isMultiSelection = selectedCount > 1;
  const isHovered = hoveredNodeId === nodeId;
  const previousIsActive =
    Boolean(previousLayer?.isSelected) ||
    (previousNodeId ? hoveredNodeId === previousNodeId : false);
  const nextIsActive =
    Boolean(nextLayer?.isSelected) ||
    (nextNodeId ? hoveredNodeId === nextNodeId : false);
  const joinWithPrevious = (layer.isSelected || isHovered) && previousIsActive;
  const joinWithNext = (layer.isSelected || isHovered) && nextIsActive;
  const primaryButtonClassName = getLayerPrimaryButtonClassName({
    isSelected: layer.isSelected,
    joinWithNext,
    joinWithPrevious,
  });
  const visibilityButtonClassName = getLayerVisibilityButtonClassName({
    isSelected: layer.isSelected,
    isVisible: layer.isVisible,
    joinWithNext,
    joinWithPrevious,
  });
  const glyphClassName = getLayerGlyphClassName({
    isSelected: layer.isSelected,
    isVisible: layer.isVisible,
  });
  const labelClassName = getLayerLabelClassName({
    isSelected: layer.isSelected,
    isVisible: layer.isVisible,
  });
  const handleSelect = (event) => {
    if (event.shiftKey) {
      editor.toggleSelection(nodeId);
      return;
    }

    editor.ensureSelected(nodeId);
  };

  return (
    <SortableItem id={nodeId}>
      {({ dragHandleProps, isDragging, itemStyle, setItemRef }) => {
        return (
          <ContextMenu.Root>
            <ContextMenu.Trigger
              className="block"
              onContextMenuCapture={() => editor.ensureSelected(nodeId)}
              onPointerEnter={() => editor.setHoveredNode(nodeId)}
              onPointerLeave={() => {
                if (editor.hoveredNodeId !== nodeId) {
                  return;
                }

                editor.setHoveredNode(null);
              }}
              ref={setItemRef}
              style={itemStyle}
            >
              <div
                className={cn(
                  "group flex items-stretch gap-0 transition-[transform,opacity,box-shadow]",
                  isDragging && "scale-[0.985] opacity-80"
                )}
              >
                <button
                  aria-pressed={layer.isSelected}
                  className={primaryButtonClassName}
                  onClick={handleSelect}
                  onDoubleClick={() => editor.startEditing(layer.node)}
                  onFocus={(event) => {
                    if (!event.currentTarget.matches(":focus-visible")) {
                      return;
                    }

                    editor.select(nodeId);
                  }}
                  type="button"
                >
                  <span
                    className="flex min-w-0 flex-1 items-center gap-2"
                    {...dragHandleProps}
                  >
                    <span aria-hidden="true" className={glyphClassName}>
                      <LayerGlyph
                        icon={TextFontIcon}
                        size={16}
                        strokeWidth={1.7}
                      />
                    </span>
                    <span className={labelClassName}>{layer.label}</span>
                  </span>
                </button>

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
                  <LayerGlyph
                    icon={VisibilityIcon}
                    size={16}
                    strokeWidth={1.8}
                  />
                </button>
              </div>
            </ContextMenu.Trigger>

            <LayerContextMenuPopup>
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
                disabled={!isMultiSelection && layer.isFrontmost}
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
                disabled={!isMultiSelection && layer.isBackmost}
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
        );
      }}
    </SortableItem>
  );
};
