import type { Appearance } from "@punchpress/engine";
import { PERF_COUNTERS } from "@punchpress/engine";
import { Button } from "@/components/ui/button";
import { useEditor } from "../../../../editor-react/use-editor";
import { useEditorValue } from "../../../../editor-react/use-editor-value";
import { usePerformanceRenderCounter } from "../../../../performance/use-performance-render-counter";
import { FieldRow, Section } from "../field-primitives";
import { AppearanceContext } from "./appearance-context";

// Reads the selection's shared stack. Multi-selections share a stack only when
// every stack is equal apart from layer ids; otherwise the lists are replaced by
// a mixed row that can copy the first stack onto the whole selection.
export const AppearanceRoot = ({ children }) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesSection);
  const property = useEditorValue((editor, state) => {
    return editor.getSelectionPropertiesSnapshot(state.selectedNodeIds)
      .selectionProperties.properties.appearance;
  });

  if (!property) {
    return null;
  }

  if (property.isMixed) {
    return <AppearanceMixed />;
  }

  return (
    <AppearanceContext.Provider value={{ appearance: property.value }}>
      {children}
    </AppearanceContext.Provider>
  );
};

const AppearanceMixed = () => {
  const editor = useEditor();
  const firstAppearance = useEditorValue((editor, state) => {
    const nodeId = state.selectedNodeIds[0];
    const node = nodeId ? editor.getNode(nodeId) : null;
    // A multi-path vector's stacks live on its child paths.
    const source =
      node?.type === "vector"
        ? editor.getNode(editor.getChildNodeIds(node.id)[0])
        : node;

    return (source?.appearance as Appearance | undefined) ?? null;
  });

  return (
    <Section className="border-black/4 border-t" title="Appearance">
      <FieldRow label="Mixed">
        <Button
          disabled={!firstAppearance}
          onClick={() => {
            if (firstAppearance) {
              editor.setAppearance(firstAppearance);
            }
          }}
          size="xs"
          variant="outline"
        >
          Use first
        </Button>
      </FieldRow>
    </Section>
  );
};
