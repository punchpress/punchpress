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
import { HugeiconsIcon } from "@hugeicons/react";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuShortcut,
  MenuTrigger,
} from "@/components/ui/menu";
import { SortableItem, SortableList } from "@/components/ui/sortable-list";
import { cn } from "@/lib/utils";
import { useEditor } from "../../editor/use-editor";
import { useEditorValue } from "../../editor/use-editor-value";
import { SettingsDialog } from "../settings-dialog";

const LayerGlyph = ({ icon, size = 18, strokeWidth = 1.8 }) => {
  return (
    <HugeiconsIcon
      color="currentColor"
      icon={icon}
      size={size}
      strokeWidth={strokeWidth}
    />
  );
};

const LayerContextMenuPopup = ({
  children,
  className,
  sideOffset = 6,
  align = "start",
  ...props
}) => {
  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner
        align={align}
        className="z-50"
        sideOffset={sideOffset}
      >
        <ContextMenu.Popup
          className={cn(
            "relative flex min-w-[var(--menu-min-width)] origin-(--transform-origin) rounded-lg border bg-popover not-dark:bg-clip-padding shadow-lg/5 outline-none before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] focus:outline-none dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
            className
          )}
          {...props}
        >
          <div className="max-h-(--available-height) w-full overflow-y-auto p-1">
            {children}
          </div>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
};

const LayerContextMenuItem = ({ className, ...props }) => {
  return (
    <ContextMenu.Item
      className={cn(
        "flex min-h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  );
};

const LayerContextMenuSeparator = ({ className, ...props }) => {
  return (
    <ContextMenu.Separator
      className={cn("mx-2 my-1 h-px bg-border", className)}
      {...props}
    />
  );
};

const LAYER_SHORTCUTS = {
  duplicate: "\u2318J",
  bringToFront: "]",
  sendToBack: "[",
};

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

const SortableLayerRow = ({
  nodeId,
  previousNodeId,
  nextNodeId,
  hoveredNodeId,
  onHoverChange,
}) => {
  const editor = useEditor();
  const layer = useEditorValue((editor) => editor.getLayerRow(nodeId));
  const previousLayer = useEditorValue((editor) => {
    return previousNodeId ? editor.getLayerRow(previousNodeId) : null;
  });
  const nextLayer = useEditorValue((editor) => {
    return nextNodeId ? editor.getLayerRow(nextNodeId) : null;
  });
  const selectedCount = useEditorValue((editor) => {
    return editor.isNodeSelected(nodeId) ? editor.selectedNodeIds.length : 1;
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
      editor.toggleNodeSelection(nodeId);
      return;
    }

    editor.ensureNodeSelected(nodeId);
  };

  return (
    <SortableItem id={nodeId}>
      {({ dragHandleProps, isDragging, itemStyle, setItemRef }) => {
        return (
          <ContextMenu.Root>
            <ContextMenu.Trigger
              className="block"
              onContextMenuCapture={() => editor.ensureNodeSelected(nodeId)}
              onPointerEnter={() => onHoverChange(nodeId)}
              onPointerLeave={() => onHoverChange(null)}
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

                    editor.selectNode(nodeId);
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
                    editor.toggleNodeVisibility(nodeId);
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
              <LayerContextMenuItem
                onClick={() => editor.duplicateNode(nodeId)}
              >
                <LayerGlyph icon={Copy01Icon} size={17} strokeWidth={1.7} />
                Duplicate
                <MenuShortcut>{LAYER_SHORTCUTS.duplicate}</MenuShortcut>
              </LayerContextMenuItem>
              <LayerContextMenuItem
                onClick={() => editor.toggleNodeVisibility(nodeId)}
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
                onClick={() => editor.bringNodeToFront(nodeId)}
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
                onClick={() => editor.sendNodeToBack(nodeId)}
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

export const LayersPanel = () => {
  const editor = useEditor();
  const layerNodeIds = useEditorValue((editor) => editor.layerNodeIds);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col rounded-xl border border-[var(--designer-border)] bg-[var(--designer-surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]">
        <div className="flex items-center px-2.5 pt-2.5 pb-1.5">
          <Menu modal={false}>
            <Button
              aria-label="Open main menu"
              className="h-11 rounded-[16px] px-2.5"
              render={<MenuTrigger />}
              type="button"
              variant="ghost"
            >
              <span className="flex size-5 items-center justify-center">
                <img
                  alt=""
                  aria-hidden="true"
                  className="h-4.5 w-4.5"
                  height="18"
                  src="/logo.svg"
                  width="18"
                />
              </span>
              <ChevronDownIcon
                className="size-4 opacity-80"
                strokeWidth={2.2}
              />
            </Button>
            <MenuPopup
              align="start"
              className="min-w-[var(--menu-min-width)]"
              sideOffset={12}
            >
              <MenuGroup>
                <MenuGroupLabel>PunchPress</MenuGroupLabel>
                <MenuItem onClick={() => setIsSettingsOpen(true)}>
                  Settings
                </MenuItem>
                <MenuSeparator />
                <MenuItem disabled>Export</MenuItem>
              </MenuGroup>
            </MenuPopup>
          </Menu>
        </div>

        <div className="flex flex-col gap-[0.5px] px-1 pb-1">
          {layerNodeIds.length > 0 ? (
            <SortableList
              items={layerNodeIds}
              onReorder={(nextIds) => {
                editor.setNodeOrder([...nextIds].reverse());
              }}
              onReorderStart={(nodeId) => {
                editor.ensureNodeSelected(nodeId);
              }}
            >
              {layerNodeIds.map((nodeId, index) => {
                return (
                  <SortableLayerRow
                    hoveredNodeId={hoveredNodeId}
                    key={nodeId}
                    nextNodeId={layerNodeIds[index + 1] || null}
                    nodeId={nodeId}
                    onHoverChange={setHoveredNodeId}
                    previousNodeId={layerNodeIds[index - 1] || null}
                  />
                );
              })}
            </SortableList>
          ) : (
            <p className="m-0 px-2.5 py-3 text-[12px] text-[var(--designer-text-muted)] leading-1.5">
              No layers yet. Press{" "}
              <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-[var(--designer-border)] bg-foreground/5 px-1 font-medium text-[11px] text-foreground/55">
                T
              </kbd>{" "}
              or use the text tool in the bottom toolbar to add text.
            </p>
          )}
        </div>
      </div>

      <SettingsDialog onOpenChange={setIsSettingsOpen} open={isSettingsOpen} />
    </>
  );
};
