import { PERF_COUNTERS } from "@punchpress/engine";
import { SortableList } from "@/components/ui/sortable-list";
import { useEditor } from "../../../../editor-react/use-editor";
import { useEditorValue } from "../../../../editor-react/use-editor-value";
import { usePerformanceRenderCounter } from "../../../../performance/use-performance-render-counter";

// Rows follow stored order: index 0 first. Shadows paint in that order, each
// under the object, so the top row paints first (lowest). The list
// re-renders only when the effect ids change.
export const EffectsList = ({
  children,
}: {
  children: (effectId: string) => React.ReactNode;
}) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesSection);
  const editor = useEditor();
  // The selector returns a fresh array; the shallow compare keeps the
  // previous one while the ids match, so the sortable rows stay put.
  const ids = useEditorValue((editor, state) => {
    return editor.getEffectIds(state.selectedNodeIds);
  });

  if (ids.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-(--field-gap)">
      <SortableList
        items={ids}
        onMove={({ activeId, overId }) => {
          // Moving onto a row takes its slot. Both resolve against the
          // current stack.
          const index = editor.getEffect(activeId)?.index;
          const toIndex = editor.getEffect(overId)?.index;

          if (index !== undefined && toIndex !== undefined) {
            editor.moveEffect(index, toIndex);
          }
        }}
      >
        {ids.map((effectId) => children(effectId))}
      </SortableList>
    </div>
  );
};
