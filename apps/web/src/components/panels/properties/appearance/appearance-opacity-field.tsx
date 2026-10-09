import { PERF_COUNTERS } from "@punchpress/engine";
import { useState } from "react";
import { ScrubSlider } from "@/components/ui/scrub-slider";
import { useEditor } from "../../../../editor-react/use-editor";
import { useEditorValue } from "../../../../editor-react/use-editor-value";
import { usePerformanceRenderCounter } from "../../../../performance/use-performance-render-counter";
import { FieldRow, Section } from "../field-primitives";
import { NumberField } from "../number-field";
import { usePropertyScrubHistory } from "../use-property-scrub-history";

// Node opacity in percent; it applies to the composited node, every layer at
// once.
export const AppearanceOpacityField = () => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderPanelPropertiesSection);
  const editor = useEditor();
  const history = usePropertyScrubHistory("edit opacity");
  // A selection that opened as mixed keeps the numeric field until the
  // selection changes, so typing a value that unifies it does not swap the
  // control mid-entry.
  const [mixedSelectionKey, setMixedSelectionKey] = useState<string | null>(
    null
  );
  const selectionKey = useEditorValue((_editor, state) => {
    return state.selectedNodeIds.join("\0");
  });
  const property = useEditorValue((editor, state) => {
    const opacity = editor.getSelectionProperty(
      "opacity",
      state.selectedNodeIds
    );

    return opacity
      ? { isMixed: opacity.isMixed, value: opacity.value as number }
      : null;
  });

  if (property?.isMixed && mixedSelectionKey !== selectionKey) {
    setMixedSelectionKey(selectionKey);
  }

  if (!property) {
    return null;
  }

  const setOpacity = (percent: number) => {
    editor.setSelectionProperty("opacity", percent / 100);
  };

  return (
    <Section title="Layer">
      <FieldRow label="Opacity">
        {property.isMixed || mixedSelectionKey === selectionKey ? (
          <NumberField
            min={0}
            onValueChange={(percent) => setOpacity(Math.min(100, percent))}
            placeholder="Mixed"
            value={property.isMixed ? 0 : Math.round(property.value * 100)}
          />
        ) : (
          <ScrubSlider
            ariaLabel="Opacity"
            formatValue={(value) => `${Math.round(value)}%`}
            max={100}
            min={0}
            onScrubEnd={history.onScrubEnd}
            onScrubStart={history.onScrubStart}
            onValueChange={setOpacity}
            size="field"
            value={Math.round(property.value * 100)}
          />
        )}
      </FieldRow>
    </Section>
  );
};
