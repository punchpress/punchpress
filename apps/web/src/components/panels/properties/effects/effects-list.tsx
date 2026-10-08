import { SortableList } from "@/components/ui/sortable-list";
import { useEditor } from "../../../../editor-react/use-editor";
import { useEffects } from "./effects-context";

// Rows follow stored order: index 0 first. Shadows paint in that order, each
// under the object, so the top row paints first (lowest).
export const EffectsList = ({
  children,
}: {
  children: (effectId: string) => React.ReactNode;
}) => {
  const editor = useEditor();
  const effects = useEffects();
  const ids = effects.map((effect) => effect.id);

  if (ids.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2">
      <SortableList
        items={ids}
        onMove={({ activeId, overId }) => {
          // Moving onto a row takes its slot.
          const index = ids.indexOf(activeId);
          const toIndex = ids.indexOf(overId);

          if (index >= 0 && toIndex >= 0) {
            editor.moveEffect(index, toIndex);
          }
        }}
      >
        {ids.map((effectId) => children(effectId))}
      </SortableList>
    </div>
  );
};
