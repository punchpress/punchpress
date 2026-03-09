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

const SortableLayerRow = ({ nodeId }) => {
  const editor = useEditor();
  const layer = useEditorValue((editor) => editor.getLayerRow(nodeId));

  if (!layer) {
    return null;
  }

  const VisibilityIcon = layer.isVisible ? ViewIcon : ViewOffIcon;

  return (
    <SortableItem id={nodeId}>
      {({ dragHandleProps, isDragging, itemStyle, setItemRef }) => {
        return (
          <ContextMenu.Root>
            <ContextMenu.Trigger
              className="block"
              onContextMenuCapture={() => editor.selectNode(nodeId)}
              ref={setItemRef}
              style={itemStyle}
            >
              <div
                className={cn(
                  "group flex items-stretch gap-0 rounded-[10px] p-0.5 transition-[transform,opacity,box-shadow]",
                  isDragging && "scale-[0.985] opacity-80"
                )}
              >
                <Button
                  className={cn(
                    "h-auto min-w-0 flex-1 justify-start gap-2 rounded-r-none rounded-l-[8px] border-0 bg-transparent px-2 py-1.5 text-left text-[13px] text-inherit shadow-none transition-[box-shadow,opacity] hover:bg-[var(--designer-hover)]",
                    !layer.isSelected &&
                      "group-hover:bg-[var(--designer-hover)]",
                    layer.isSelected &&
                      "bg-blue-600 text-white shadow-[0_10px_22px_rgba(37,99,235,0.22)] hover:bg-blue-600 hover:text-white"
                  )}
                  onClick={() => editor.selectNode(nodeId)}
                  onDoubleClick={() => editor.startEditing(layer.node)}
                  type="button"
                  variant="ghost"
                >
                  <span
                    className="flex min-w-0 flex-1 items-center gap-2"
                    {...dragHandleProps}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "inline-flex shrink-0 cursor-grab items-center justify-center text-foreground/35 active:cursor-grabbing",
                        !(layer.isVisible || layer.isSelected) &&
                          "text-foreground/22",
                        layer.isSelected && "text-white/70"
                      )}
                    >
                      <LayerGlyph
                        icon={TextFontIcon}
                        size={16}
                        strokeWidth={1.7}
                      />
                    </span>
                    <span
                      className={cn(
                        "min-w-0 cursor-grab truncate whitespace-nowrap font-[450] active:cursor-grabbing",
                        !(layer.isVisible || layer.isSelected) &&
                          "text-foreground/55"
                      )}
                    >
                      {layer.label}
                    </span>
                  </span>
                </Button>

                <Button
                  aria-label={layer.visibilityLabel}
                  className={cn(
                    "h-auto shrink-0 rounded-r-[8px] rounded-l-none border-0 bg-transparent px-2 text-foreground/34 shadow-none hover:bg-[var(--designer-hover)] hover:text-foreground/70",
                    layer.isVisible &&
                      !layer.isSelected &&
                      "opacity-0 group-hover:opacity-100",
                    !layer.isSelected &&
                      "group-hover:bg-[var(--designer-hover)]",
                    !layer.isVisible && "text-foreground/60 opacity-100",
                    layer.isSelected &&
                      "bg-blue-600 text-white/65 hover:bg-blue-600 hover:text-white"
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    editor.toggleNodeVisibility(nodeId);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  type="button"
                  variant="ghost"
                >
                  <LayerGlyph
                    icon={VisibilityIcon}
                    size={16}
                    strokeWidth={1.8}
                  />
                </Button>
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
                disabled={layer.isFrontmost}
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
                disabled={layer.isBackmost}
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

        <div className="flex flex-col gap-px px-1 pb-1">
          {layerNodeIds.length > 0 ? (
            <SortableList
              items={layerNodeIds}
              onReorder={(nextIds) => {
                editor.setNodeOrder([...nextIds].reverse());
              }}
              onReorderStart={(nodeId) => {
                editor.selectNode(nodeId);
              }}
            >
              {layerNodeIds.map((nodeId) => {
                return <SortableLayerRow key={nodeId} nodeId={nodeId} />;
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
