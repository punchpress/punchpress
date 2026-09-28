import { TEXT_TRACKING_RANGE } from "@punchpress/engine";
import {
  createLocalFontDescriptor,
  createLocalFontOption,
} from "@punchpress/punch-schema";
import { FontPicker } from "@/components/fonts-picker/font-picker";
import { Input } from "@/components/ui/input";
import { ScrubSlider } from "@/components/ui/scrub-slider";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import { FieldRow, Section } from "./field-primitives";

const FONT_SIZE_RANGE = { min: 1, max: 2000 };
const TRACKING_SCRUB_RANGE = { min: -500, max: 500 };
export const TextFields = ({ node }) => {
  const editor = useEditor();
  const availableFonts = useEditorValue((editor) => editor.availableFonts);
  const fontCatalogState = useEditorValue((editor) => editor.fontCatalogState);
  const fontCatalogError = useEditorValue((editor) => editor.bootstrapError);

  if (!node) {
    return null;
  }

  const fontAvailability = editor.getFontAvailability(node.font);
  const fontStatus = {
    "action-required":
      "Enable local font access to render this saved font accurately.",
    error: "Local font access failed. The saved font is unchanged.",
    loading: "Checking local fonts. The saved font is unchanged.",
    "load-error":
      "This font was found but could not be loaded. The saved font is unchanged.",
    missing:
      "This font is not installed. The saved font is unchanged until you choose another.",
    "permission-denied":
      "Local font access was denied. The saved font is unchanged.",
    unsupported:
      "This browser cannot access local fonts. The saved font is unchanged.",
  }[fontAvailability];

  return (
    <Section title="Text">
      <FieldRow label="Text">
        <Input
          nativeInput
          onChange={(event) =>
            editor.setSelectionProperty("text", event.target.value)
          }
          value={node.text}
        />
      </FieldRow>

      <FieldRow label="Font">
        <div className="min-w-0">
          <FontPicker
            fonts={availableFonts}
            onRequestFonts={() => {
              editor.requestLocalFonts().catch(() => undefined);
            }}
            onValueChange={(font) => {
              editor.setLastUsedFont(font);
              editor.setSelectionProperty(
                "font",
                createLocalFontDescriptor(font)
              );
            }}
            state={fontCatalogState}
            stateMessage={fontCatalogError}
            value={createLocalFontOption(node.font)}
          />
          {fontStatus ? (
            <output className="mt-2 block text-muted-foreground text-xs">
              {fontStatus}
            </output>
          ) : null}
        </div>
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
          max={TEXT_TRACKING_RANGE.max}
          min={TEXT_TRACKING_RANGE.min}
          onValueChange={(nextTracking) => {
            editor.setSelectionProperty("tracking", nextTracking);
          }}
          scrubMax={TRACKING_SCRUB_RANGE.max}
          scrubMin={TRACKING_SCRUB_RANGE.min}
          value={node.tracking}
        />
      </FieldRow>
    </Section>
  );
};
