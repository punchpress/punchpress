import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon } from "@hugeicons-pro/core-stroke-rounded";
import type { AppearanceList as AppearanceListId } from "@punchpress/engine";
import { MAX_APPEARANCE_LAYERS } from "@punchpress/punch-schema";
import { Button } from "@/components/ui/button";
import { SortableList } from "@/components/ui/sortable-list";
import { useEditor } from "../../../../editor-react/use-editor";
import { AppearanceListContext, useAppearance } from "./appearance-context";

const LIST_TITLES = { fills: "Fill", strokes: "Stroke" };

// One section per stack list. Rows show the topmost paint first, so the
// displayed order is the reverse of the stored bottom-to-top order.
export const AppearanceListSection = ({
  children,
  list,
}: {
  children: (layerId: string) => React.ReactNode;
  list: AppearanceListId;
}) => {
  const editor = useEditor();
  const appearance = useAppearance();
  const layers = appearance[list];
  const displayIds = layers.map((layer) => layer.id).reverse();
  const title = LIST_TITLES[list];

  return (
    <AppearanceListContext.Provider value={{ list }}>
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
            disabled={layers.length >= MAX_APPEARANCE_LAYERS}
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
              // Stored order is bottom-to-top; moving onto a row takes its slot.
              const index = layers.findIndex((layer) => layer.id === activeId);
              const toIndex = layers.findIndex((layer) => layer.id === overId);

              if (index >= 0 && toIndex >= 0) {
                editor.moveAppearanceLayer({ index, list }, toIndex);
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
