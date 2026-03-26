import {
  createLocalFontDescriptor,
  createLocalFontOption,
} from "@punchpress/punch-schema";
import { LinkIcon } from "lucide-react";
import { FontPicker } from "@/components/fonts-picker/font-picker";
import { Input } from "@/components/ui/input";
import { ScrubSlider } from "@/components/ui/scrub-slider";
import { Toggle } from "@/components/ui/toggle";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { FieldRow, PairedRow, Section } from "./field-primitives";

const FONT_SIZE_RANGE = { min: 1, max: 2000 };
const TRACKING_RANGE = { min: -200, max: 400 };

export const TextFields = ({ node }) => {
  const editor = useEditor();
  const availableFonts = useEditorValue((editor) => editor.availableFonts);
  const fontCatalogState = useEditorValue((editor) => editor.fontCatalogState);
  const fontCatalogError = useEditorValue((editor) => editor.bootstrapError);

  if (!node) {
    return null;
  }

  return (
    <Section title="Text">
      <FieldRow label="Text">
        <Input
          nativeInput
          onChange={(event) => editor.setSelectionProperty("text", event.target.value)}
          value={node.text}
        />
      </FieldRow>

      <FieldRow label="Font">
        <FontPicker
          fonts={availableFonts}
          onRequestFonts={() => {
            editor.requestLocalFonts().catch(() => undefined);
          }}
          onValueChange={(font) => {
            editor.setLastUsedFont(font);
            editor.setSelectionProperty("font", createLocalFontDescriptor(font));
          }}
          state={fontCatalogState}
          stateMessage={fontCatalogError}
          value={createLocalFontOption(node.font)}
        />
      </FieldRow>

      <FieldRow label="Size">
        <ScrubSlider
          ariaLabel="Font size"
          max={FONT_SIZE_RANGE.max}
          min={FONT_SIZE_RANGE.min}
          onValueChange={(nextFontSize) => {
            editor.setSelectionProperty("fontSize", nextFontSize);
          }}
          value={node.fontSize}
        />
      </FieldRow>

      <FieldRow label="Tracking">
        <ScrubSlider
          ariaLabel="Tracking"
          max={TRACKING_RANGE.max}
          min={TRACKING_RANGE.min}
          onValueChange={(nextTracking) => {
            editor.setSelectionProperty("tracking", nextTracking);
          }}
          value={node.tracking}
        />
      </FieldRow>
    </Section>
  );
};
