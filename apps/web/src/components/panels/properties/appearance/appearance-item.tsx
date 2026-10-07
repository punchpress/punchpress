import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
  DragDropVerticalIcon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons-pro/core-stroke-rounded";
import { parseColor } from "@punchpress/punch-schema";
import { Button } from "@/components/ui/button";
import { SortableItem } from "@/components/ui/sortable-list";
import { cn } from "@/lib/utils";
import { useEditor } from "../../../../editor-react/use-editor";
import { ColorField } from "../field-primitives";
import { useAppearanceLayer, useAppearanceList } from "./appearance-context";

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
              <ColorField
                onChange={(value) => {
                  const parsed = parseColor(value);

                  if (parsed) {
                    editor.updateAppearanceLayer(slot, {
                      color: parsed.color,
                      opacity: parsed.opacity,
                    });
                  }
                }}
                onInteractionEnd={undefined}
                onInteractionStart={undefined}
                placeholder={undefined}
                stateKey={`appearance-${list}-${layerId}`}
                value={formatLayerColor(layer.paint.color, layer.opacity)}
              />
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
          {children}
        </div>
      )}
    </SortableItem>
  );
};

// The picker edits color and alpha together; alpha is the layer opacity.
const formatLayerColor = (color: string, opacity: number) => {
  if (opacity >= 1) {
    return color;
  }

  const value = Number.parseInt(color.slice(1), 16);

  return `rgba(${Math.floor(value / 65_536)}, ${Math.floor(value / 256) % 256}, ${value % 256}, ${Number(opacity.toFixed(3))})`;
};
