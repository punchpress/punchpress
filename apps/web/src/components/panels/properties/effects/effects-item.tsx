import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
  DragDropVerticalIcon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons-pro/core-stroke-rounded";
import { PERF_COUNTERS } from "@punchpress/engine";
import { parseColor } from "@punchpress/punch-schema";
import { Button } from "@/components/ui/button";
import { SortableItem } from "@/components/ui/sortable-list";
import { cn } from "@/lib/utils";
import { useEditor } from "../../../../editor-react/use-editor";
import { usePerformanceRenderCounter } from "../../../../performance/use-performance-render-counter";
import { formatColorWithOpacity } from "../appearance/appearance-paint-swatch";
import { ColorField } from "../field-primitives";
import { usePropertyScrubHistory } from "../use-property-scrub-history";
import { useEffectSlot } from "./effects-context";

// One effect row: drag handle, visibility, shadow color with opacity, remove.
// Kind-specific fields render beneath through `children`.
export const EffectsItem = ({
  children,
  effectId,
}: {
  children?: React.ReactNode;
  effectId: string;
}) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesRow);
  const editor = useEditor();
  const colorHistory = usePropertyScrubHistory("edit shadow color");
  const resolved = useEffectSlot(effectId);

  if (!resolved) {
    return null;
  }

  const { effect, index } = resolved;

  return (
    <SortableItem id={effectId}>
      {({ dragHandleProps, isDragging, itemStyle, setItemRef }) => (
        <div
          className={cn("grid gap-2", isDragging && "opacity-60")}
          data-effect-id={effectId}
          data-testid="effects-item"
          ref={setItemRef}
          style={itemStyle}
        >
          <div className="grid grid-cols-[16px_24px_minmax(0,1fr)_24px] items-center gap-1">
            <button
              aria-label="Reorder effect"
              className="flex cursor-grab items-center text-foreground/40"
              type="button"
              {...dragHandleProps}
            >
              <HugeiconsIcon icon={DragDropVerticalIcon} size={14} />
            </button>
            <Button
              aria-label={effect.enabled ? "Hide effect" : "Show effect"}
              aria-pressed={effect.enabled}
              onClick={() => {
                editor.updateEffect(index, { enabled: !effect.enabled });
              }}
              size="icon-xs"
              variant="ghost"
            >
              <HugeiconsIcon
                icon={effect.enabled ? ViewIcon : ViewOffIcon}
                size={14}
                strokeWidth={1.8}
              />
            </Button>
            <div className={cn("min-w-0", !effect.enabled && "opacity-50")}>
              <ColorField
                onChange={(value) => {
                  const parsed = parseColor(value);

                  if (parsed) {
                    editor.updateEffect(index, {
                      color: parsed.color,
                      opacity: parsed.opacity,
                    });
                  }
                }}
                onInteractionEnd={colorHistory.onScrubEnd}
                onInteractionStart={colorHistory.onScrubStart}
                placeholder={undefined}
                stateKey={`effect-${effectId}`}
                value={formatColorWithOpacity(effect.color, effect.opacity)}
              />
            </div>
            <Button
              aria-label="Remove effect"
              onClick={() => {
                editor.removeEffect(index);
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
