import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
  DragDropVerticalIcon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons-pro/core-stroke-rounded";
import { PERF_COUNTERS } from "@punchpress/engine";
import { Button } from "@/components/ui/button";
import { SortableItem } from "@/components/ui/sortable-list";
import { cn } from "@/lib/utils";
import { useEditor } from "../../../../editor-react/use-editor";
import { usePerformanceRenderCounter } from "../../../../performance/use-performance-render-counter";
import {
  useAppearanceLayerSlot,
  useAppearanceLayerValue,
  useAppearanceList,
  useUpdateAppearanceLayer,
} from "./appearance-context";
import { AppearancePaintFields } from "./appearance-paint-fields";
import { AppearancePaintSwatch } from "./appearance-paint-swatch";

// One layer row: drag handle, visibility, paint color with opacity, remove.
// Stroke rows add their geometry controls beneath through `children`. The
// row chrome subscribes to visibility only; paint and geometry controls
// subscribe to their own values.
export const AppearanceItem = ({
  children,
  layerId,
}: {
  children?: React.ReactNode;
  layerId: string;
}) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesRow);
  const editor = useEditor();
  const list = useAppearanceList();
  const enabled = useAppearanceLayerValue(layerId, (layer) => layer.enabled);
  const resolveSlot = useAppearanceLayerSlot(layerId);
  const updateLayer = useUpdateAppearanceLayer(layerId);

  if (enabled === null) {
    return null;
  }

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
              aria-label={enabled ? `Hide ${label}` : `Show ${label}`}
              aria-pressed={enabled}
              onClick={() => updateLayer({ enabled: !enabled })}
              size="icon-xs"
              variant="ghost"
            >
              <HugeiconsIcon
                icon={enabled ? ViewIcon : ViewOffIcon}
                size={14}
                strokeWidth={1.8}
              />
            </Button>
            <div className={cn("min-w-0", !enabled && "opacity-50")}>
              <AppearancePaintSwatch layerId={layerId} />
            </div>
            <Button
              aria-label={`Remove ${label}`}
              onClick={() => {
                const slot = resolveSlot();

                if (slot) {
                  editor.removeAppearanceLayer(slot);
                }
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
