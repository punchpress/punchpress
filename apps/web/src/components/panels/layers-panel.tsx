import { ChevronDownIcon, TypeIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { useEditor } from "../../editor/use-editor";
import { useEditorValue } from "../../editor/use-editor-value";
import { SettingsDialog } from "../settings-dialog";

const getLayerLabel = (node, index) => {
  const text = node.text.trim();
  if (text.length > 0) {
    return text;
  }

  return `Text ${index + 1}`;
};

export const LayersPanel = () => {
  const editor = useEditor();
  const nodes = useEditorValue((_, state) => state.nodes);
  const selectedNodeId = useEditorValue((_, state) => state.selectedNodeId);
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
            <MenuPopup align="start" className="min-w-44" sideOffset={12}>
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
          {nodes.map((node, index) => {
            const isSelected = node.id === selectedNodeId;

            return (
              <button
                className={cn(
                  "flex w-full cursor-default items-center gap-2 rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-[13px] text-inherit transition-colors hover:bg-foreground/4",
                  isSelected && "bg-blue-600 text-white hover:bg-blue-600"
                )}
                key={node.id}
                onClick={() => editor.selectNode(node.id)}
                onDoubleClick={() => editor.startEditing(node)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center text-foreground/35",
                    isSelected && "text-white/70"
                  )}
                >
                  <TypeIcon size={12} />
                </span>
                <span className="min-w-0 flex-1 truncate whitespace-nowrap font-[450]">
                  {getLayerLabel(node, index)}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[11px] text-[var(--designer-text-muted)] tabular-nums",
                    isSelected && "text-white/60"
                  )}
                >
                  {Math.round(node.fontSize)}
                </span>
              </button>
            );
          })}

          {nodes.length === 0 && (
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
