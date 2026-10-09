import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
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
import { LayerRow } from "../layer-row";
import { usePropertyScrubHistory } from "../use-property-scrub-history";
import {
  useEffectIndex,
  useEffectValue,
  useUpdateEffect,
} from "./use-effect-controls";

// One effect row: drag handle, visibility, shadow color with opacity, remove.
// Kind-specific `details` show beneath the row or in a settings popover, by
// density. The row chrome subscribes to visibility only; the color and fields
// subscribe to their own values.
export const EffectsItem = ({
  details,
  effectId,
}: {
  details?: React.ReactNode;
  effectId: string;
}) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesRow);
  const editor = useEditor();
  const enabled = useEffectValue(effectId, (effect) => effect.enabled);
  const resolveIndex = useEffectIndex(effectId);
  const updateEffect = useUpdateEffect(effectId);

  if (enabled === null) {
    return null;
  }

  return (
    <SortableItem id={effectId}>
      {({ dragHandleProps, isDragging, itemStyle, setItemRef }) => (
        <LayerRow.Root
          className={cn(isDragging && "opacity-60")}
          data-effect-id={effectId}
          data-testid="effects-item"
          ref={setItemRef}
          style={itemStyle}
        >
          <LayerRow.Header>
            <LayerRow.DragHandle
              aria-label="Reorder effect"
              {...dragHandleProps}
            />
            <Button
              aria-label={enabled ? "Hide effect" : "Show effect"}
              aria-pressed={enabled}
              onClick={() => updateEffect({ enabled: !enabled })}
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
              <EffectColorField effectId={effectId} />
            </div>
            {details ? (
              <LayerRow.Settings title="Shadow">{details}</LayerRow.Settings>
            ) : null}
            <Button
              aria-label="Remove effect"
              onClick={() => {
                const index = resolveIndex();

                if (index !== null) {
                  editor.removeEffect(index);
                }
              }}
              size="icon-field"
              variant="ghost"
            >
              <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.8} />
            </Button>
          </LayerRow.Header>
          {details ? <LayerRow.Details>{details}</LayerRow.Details> : null}
        </LayerRow.Root>
      )}
    </SortableItem>
  );
};

const EffectColorField = ({ effectId }: { effectId: string }) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesField);
  const history = usePropertyScrubHistory("edit shadow color");
  const updateEffect = useUpdateEffect(effectId);
  const color = useEffectValue(effectId, (effect) => {
    return formatColorWithOpacity(effect.color, effect.opacity);
  });

  return (
    <ColorField
      onChange={(value) => {
        const parsed = parseColor(value);

        if (parsed) {
          updateEffect({ color: parsed.color, opacity: parsed.opacity });
        }
      }}
      onInteractionEnd={history.onScrubEnd}
      onInteractionStart={history.onScrubStart}
      placeholder={undefined}
      stateKey={`effect-${effectId}`}
      value={color}
    />
  );
};
