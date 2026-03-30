import {
  TextFontIcon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons-pro/core-stroke-rounded";
import { Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { LayerGlyph } from "./layer-context-menu";

export const LayerTreeDragGhost = ({ nodeId }) => {
  const layer = useEditorValue((editor) => editor.getLayerRow(nodeId));

  if (!layer) {
    return null;
  }

  const isGroup = layer.isGroup;
  const VisibilityIcon = layer.isVisible ? ViewIcon : ViewOffIcon;

  return (
    <div className="flex min-w-[240px] max-w-[340px] items-stretch gap-0 overflow-hidden rounded-[10px] border border-[var(--designer-border)] bg-[var(--designer-surface)]/96 opacity-85 shadow-[0_10px_30px_rgba(0,0,0,0.16)]">
      <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-[13px]">
        <span
          aria-hidden="true"
          className="inline-flex shrink-0 items-center justify-center text-foreground/35"
        >
          {isGroup ? (
            <Folder size={15} strokeWidth={1.8} />
          ) : (
            <LayerGlyph icon={TextFontIcon} size={16} strokeWidth={1.7} />
          )}
        </span>
        <span
          className={cn(
            "min-w-0 truncate whitespace-nowrap font-[450]",
            !layer.isVisible && "text-foreground/55"
          )}
        >
          {layer.label}
        </span>
      </div>

      <span className="inline-flex shrink-0 items-center px-2 text-foreground/34">
        <LayerGlyph icon={VisibilityIcon} size={16} strokeWidth={1.8} />
      </span>
    </div>
  );
};
