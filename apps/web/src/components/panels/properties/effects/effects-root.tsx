import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon } from "@hugeicons-pro/core-stroke-rounded";
import { PERF_COUNTERS } from "@punchpress/engine";
import { MAX_EFFECTS } from "@punchpress/punch-schema";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { useEditor } from "../../../../editor-react/use-editor";
import { useEditorValue } from "../../../../editor-react/use-editor-value";
import { usePerformanceRenderCounter } from "../../../../performance/use-performance-render-counter";
import { FieldRow, Section } from "../field-primitives";

// Shows the selection's effect owners (a vector child path routes to its
// vector). Multi-selections share a stack only when every stack is equal apart
// from effect ids; otherwise the list is replaced by a mixed row that can copy
// the first stack onto the whole selection. Subscribes to structure only.
export const EffectsRoot = ({ children }) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesSection);
  const editor = useEditor();
  const selection = useEditorValue((editor, state) => {
    const { effects, isMixed, targetCount } = editor.getSelectionEffects(
      state.selectedNodeIds
    );

    return {
      available: targetCount > 0,
      count: effects.length,
      isMixed,
      // Different owners can reuse the same effect ids, so the list remounts
      // when the selection changes; a control never carries a gesture or
      // picker state over to another node's effect.
      scopeKey: state.selectedNodeIds.join("\0"),
    };
  });

  if (!selection.available) {
    return null;
  }

  return (
    <Section
      actions={
        <Button
          aria-label="Add effect"
          disabled={selection.isMixed || selection.count >= MAX_EFFECTS}
          onClick={() => {
            editor.addEffect("drop-shadow");
          }}
          size="icon-field"
          variant="ghost"
        >
          <HugeiconsIcon icon={PlusSignIcon} size={14} strokeWidth={1.8} />
        </Button>
      }
      data-testid="effects"
      title="Effects"
    >
      {selection.isMixed ? (
        <FieldRow label="Mixed">
          <Button
            onClick={() => {
              editor.setEffects(editor.getSelectionEffects().effects);
            }}
            size="field"
            variant="outline"
          >
            Use first
          </Button>
        </FieldRow>
      ) : (
        <Fragment key={selection.scopeKey}>{children}</Fragment>
      )}
    </Section>
  );
};
