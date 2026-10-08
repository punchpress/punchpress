import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon } from "@hugeicons-pro/core-stroke-rounded";
import { PERF_COUNTERS } from "@punchpress/engine";
import { MAX_EFFECTS } from "@punchpress/punch-schema";
import { Button } from "@/components/ui/button";
import { useEditor } from "../../../../editor-react/use-editor";
import { useEditorValue } from "../../../../editor-react/use-editor-value";
import { usePerformanceRenderCounter } from "../../../../performance/use-performance-render-counter";
import { FieldRow } from "../field-primitives";
import { EffectsContext } from "./effects-context";

// Reads the selection's effect owners (a vector child path routes to its
// vector). Multi-selections share a stack only when every stack is equal apart
// from effect ids; otherwise the list is replaced by a mixed row that can copy
// the first stack onto the whole selection.
export const EffectsRoot = ({ children }) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesSection);
  const editor = useEditor();
  // `effects` is the owner's stored array, so the shallow compare stays stable.
  const selection = useEditorValue((currentEditor, state) => {
    const { effects, isMixed, targetCount } = currentEditor.getSelectionEffects(
      state.selectedNodeIds
    );

    return targetCount > 0 ? { effects, isMixed } : { effects: null };
  });

  if (!selection.effects) {
    return null;
  }

  const { effects, isMixed } = selection;

  return (
    <section
      className="border-black/4 border-t py-4 last:pb-0"
      data-testid="effects"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-[12px] text-foreground/70 tracking-[-0.01em]">
          Effects
        </h3>
        <Button
          aria-label="Add effect"
          disabled={isMixed || effects.length >= MAX_EFFECTS}
          onClick={() => {
            editor.addEffect("drop-shadow");
          }}
          size="icon-xs"
          variant="ghost"
        >
          <HugeiconsIcon icon={PlusSignIcon} size={14} strokeWidth={1.8} />
        </Button>
      </div>
      {isMixed ? (
        <FieldRow label="Mixed">
          <Button
            onClick={() => {
              editor.setEffects(effects);
            }}
            size="xs"
            variant="outline"
          >
            Use first
          </Button>
        </FieldRow>
      ) : (
        <EffectsContext.Provider value={{ effects }}>
          {children}
        </EffectsContext.Provider>
      )}
    </section>
  );
};
