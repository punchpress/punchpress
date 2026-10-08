import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
  DragDropVerticalIcon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons-pro/core-stroke-rounded";
import { Button } from "@/components/ui/button";
import { SortableItem } from "@/components/ui/sortable-list";
import { cn } from "@/lib/utils";
import { useEditor } from "../../../../editor-react/use-editor";
import { useAppearanceLayer, useAppearanceList } from "./appearance-context";
import { AppearancePaintFields } from "./appearance-paint-fields";
import { AppearancePaintSwatch } from "./appearance-paint-swatch";

// One layer row: drag handle, visibility, paint color with opacity, remove.
// Stroke rows add their geometry controls beneath through `children`.
export const AppearanceItem = ({
  children,
  layerId,
}: {
  children?: React.ReactNode;
  layerId: string;
}) => {
  const editor = useEditor();
  const list = useAppearanceList();
  const resolved = useAppearanceLayer(layerId);

  if (!resolved) {
    return null;
  }

  const { layer, slot } = resolved;
  const label = list === "fills" ? "fill" : "stroke";

  return (
    <SortableItem id={layerId}>
      {({ dragHandleProps, isDragging, itemStyle, setItemRef }) => (
        <div
          className={cn("grid gap-2", isDragging && "opacity-60")}
          data-layer-id={layerId}
          data-testid={`appearance-${list}-item`}
          ref={setItemRef}
          style={itemStyle}
        >
          <div className="grid grid-cols-[16px_24px_minmax(0,1fr)_24px] items-center gap-1">
            <button
              aria-label={`Reorder ${label}`}
              className="flex cursor-grab items-center text-foreground/40"
              type="button"
              {...dragHandleProps}
            >
              <HugeiconsIcon icon={DragDropVerticalIcon} size={14} />
            </button>
            <Button
              aria-label={layer.enabled ? `Hide ${label}` : `Show ${label}`}
              aria-pressed={layer.enabled}
              onClick={() => {
                editor.updateAppearanceLayer(slot, { enabled: !layer.enabled });
              }}
              size="icon-xs"
              variant="ghost"
            >
              <HugeiconsIcon
                icon={layer.enabled ? ViewIcon : ViewOffIcon}
                size={14}
                strokeWidth={1.8}
              />
            </Button>
            <div className={cn("min-w-0", !layer.enabled && "opacity-50")}>
              <AppearancePaintSwatch layerId={layerId} />
            </div>
            <Button
              aria-label={`Remove ${label}`}
              onClick={() => {
                editor.removeAppearanceLayer(slot);
              }}
              size="icon-xs"
              variant="ghost"
            >
              <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.8} />
            </Button>
          </div>
          <AppearancePaintFields layerId={layerId} />
          {children}
        </div>
      )}
    </SortableItem>
  );
};
