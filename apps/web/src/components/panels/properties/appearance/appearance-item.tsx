import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons-pro/core-stroke-rounded";
import { PERF_COUNTERS } from "@punchpress/engine";
import { Button } from "@/components/ui/button";
import { SortableItem } from "@/components/ui/sortable-list";
import { cn } from "@/lib/utils";
import { useEditor } from "../../../../editor-react/use-editor";
import { usePerformanceRenderCounter } from "../../../../performance/use-performance-render-counter";
import { LayerRow } from "../layer-row";
import {
  useAppearanceLayerSlot,
  useAppearanceLayerValue,
  useAppearanceList,
  useUpdateAppearanceLayer,
} from "./appearance-context";
import { AppearancePaintSwatch } from "./appearance-paint-swatch";

// One layer row: drag handle, visibility, paint color with opacity, remove.
// `children` stay visible beneath the row (stroke width); `details` (paint
// kind, stroke style) open in the row's settings popover.
// The row chrome subscribes to visibility only; paint and geometry controls
// subscribe to their own values.
export const AppearanceItem = ({
  children,
  details,
  layerId,
}: {
  children?: React.ReactNode;
  details?: React.ReactNode;
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
        <LayerRow.Root
          className={cn(isDragging && "opacity-60")}
          data-layer-id={layerId}
          data-testid={`appearance-${list}-item`}
          ref={setItemRef}
          style={itemStyle}
        >
          <LayerRow.Header>
            <LayerRow.DragHandle
              aria-label={`Reorder ${label}`}
              {...dragHandleProps}
            />
            <Button
              aria-label={enabled ? `Hide ${label}` : `Show ${label}`}
              aria-pressed={enabled}
              onClick={() => updateLayer({ enabled: !enabled })}
              size="icon-field"
              variant="ghost"
            >
              <HugeiconsIcon
                icon={enabled ? ViewIcon : ViewOffIcon}
                size={14}
                strokeWidth={1.8}
              />
            </Button>
            <div className={cn("min-w-0 flex-1", !enabled && "opacity-50")}>
              <AppearancePaintSwatch layerId={layerId} />
            </div>
            {details ? (
              <LayerRow.Settings title={list === "fills" ? "Fill" : "Stroke"}>
                {details}
              </LayerRow.Settings>
            ) : null}
            <Button
              aria-label={`Remove ${label}`}
              onClick={() => {
                const slot = resolveSlot();

                if (slot) {
                  editor.removeAppearanceLayer(slot);
                }
              }}
              size="icon-field"
              variant="ghost"
            >
              <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.8} />
            </Button>
          </LayerRow.Header>
          <LayerRow.Fields>{children}</LayerRow.Fields>
        </LayerRow.Root>
      )}
    </SortableItem>
  );
};
