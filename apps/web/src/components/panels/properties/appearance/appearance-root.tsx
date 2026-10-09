import { PERF_COUNTERS } from "@punchpress/engine";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { useEditor } from "../../../../editor-react/use-editor";
import { useEditorValue } from "../../../../editor-react/use-editor-value";
import { usePerformanceRenderCounter } from "../../../../performance/use-performance-render-counter";
import { MixedRow, Section } from "../field-primitives";

// Shows the selection's shared stack. Multi-selections share a stack only when
// every stack is equal apart from layer ids; otherwise the lists are replaced
// by a mixed row that can copy the first stack onto the whole selection.
export const AppearanceRoot = ({ children }) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesSection);
  const selection = useEditorValue((editor, state) => {
    const appearance = editor.getSelectionAppearance(state.selectedNodeIds);

    return {
      available: Boolean(appearance),
      isMixed: Boolean(appearance?.isMixed),
      // Different nodes can reuse the same layer ids, so the lists remount
      // when the stack owners change; a control never carries a gesture or
      // picker state over to another node's layer.
      scopeKey: `${state.selectedNodeIds.join("\0")}|${state.pathEditingNodeId ?? ""}`,
    };
  });

  if (!selection.available) {
    return null;
  }

  if (selection.isMixed) {
    return <AppearanceMixed />;
  }

  return <Fragment key={selection.scopeKey}>{children}</Fragment>;
};

const AppearanceMixed = () => {
  const editor = useEditor();
  const canUseFirst = useEditorValue((editor, state) => {
    return Boolean(
      editor.getSelectionAppearance(state.selectedNodeIds)?.appearance
    );
  });

  return (
    <Section title="Appearance">
      <MixedRow>
        <Button
          disabled={!canUseFirst}
          onClick={() => {
            const first = editor.getSelectionAppearance()?.appearance;

            if (first) {
              editor.setAppearance(first);
            }
          }}
          size="field"
          variant="outline"
        >
          Use first
        </Button>
      </MixedRow>
    </Section>
  );
};
