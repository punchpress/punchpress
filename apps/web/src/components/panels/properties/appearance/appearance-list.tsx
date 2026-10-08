import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon } from "@hugeicons-pro/core-stroke-rounded";
import {
  type AppearanceList as AppearanceListId,
  PERF_COUNTERS,
} from "@punchpress/engine";
import { MAX_APPEARANCE_LAYERS } from "@punchpress/punch-schema";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { SortableList } from "@/components/ui/sortable-list";
import { useEditor } from "../../../../editor-react/use-editor";
import { useEditorValue } from "../../../../editor-react/use-editor-value";
import { usePerformanceRenderCounter } from "../../../../performance/use-performance-render-counter";
import { AppearanceListContext } from "./appearance-context";

const LIST_TITLES = { fills: "Fill", strokes: "Stroke" };

// One section per stack list. Rows show the topmost paint first, so the
// displayed order is the reverse of the stored bottom-to-top order. The
// section re-renders only when the list's layer ids change.
export const AppearanceListSection = ({
  children,
  list,
}: {
  children: (layerId: string) => React.ReactNode;
  list: AppearanceListId;
}) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesSection);
  const editor = useEditor();
  // The selector returns a fresh array; the shallow compare keeps the
  // previous one while the ids match, so the sortable rows stay put.
  const layerIds = useEditorValue((editor, state) => {
    return editor.getAppearanceLayerIds(list, state.selectedNodeIds);
  });
  const displayIds = useMemo(() => [...layerIds].reverse(), [layerIds]);
  const context = useMemo(() => ({ list }), [list]);
  const title = LIST_TITLES[list];

  return (
    <AppearanceListContext.Provider value={context}>
      <section
        className="border-black/4 border-t py-4 last:pb-0"
        data-testid={`appearance-${list}`}
      >
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-[12px] text-foreground/70 tracking-[-0.01em]">
            {title}
          </h3>
          <Button
            aria-label={`Add ${title.toLowerCase()}`}
            disabled={layerIds.length >= MAX_APPEARANCE_LAYERS}
            onClick={() => {
              if (list === "fills") {
                editor.addFill();
              } else {
                editor.addStroke();
              }
            }}
            size="icon-xs"
            variant="ghost"
          >
            <HugeiconsIcon icon={PlusSignIcon} size={14} strokeWidth={1.8} />
          </Button>
        </div>
        <div className="grid gap-2">
          <SortableList
            items={displayIds}
            onMove={({ activeId, overId }) => {
              // Stored order is bottom-to-top; moving onto a row takes its
              // slot. Both resolve against the current stack.
              const slot = editor.getAppearanceLayer(list, activeId)?.slot;
              const target = editor.getAppearanceLayer(list, overId)?.slot;

              if (slot && target) {
                editor.moveAppearanceLayer(slot, target.index);
              }
            }}
          >
            {displayIds.map((layerId) => children(layerId))}
          </SortableList>
        </div>
      </section>
    </AppearanceListContext.Provider>
  );
};
