import { ScrubSlider } from "@/components/ui/scrub-slider";
import { useEditor } from "../../../../editor-react/use-editor";
import { FieldRow } from "../field-primitives";
import { usePropertyScrubHistory } from "../use-property-scrub-history";
import { useEffectSlot } from "./effects-context";

const OFFSET_RANGE = { max: 10_000, min: -10_000 };
const OFFSET_SCRUB_RANGE = { max: 50, min: -50 };
const BLUR_RANGE = { max: 1000, min: 0 };
const BLUR_SCRUB_RANGE = { max: 50, min: 0 };

// Offset and blur of one drop shadow, in the owner's local units. Each scrub
// is one undo step.
export const EffectsShadowFields = ({ effectId }: { effectId: string }) => {
  const editor = useEditor();
  const xHistory = usePropertyScrubHistory("edit shadow x");
  const yHistory = usePropertyScrubHistory("edit shadow y");
  const blurHistory = usePropertyScrubHistory("edit shadow blur");
  const resolved = useEffectSlot(effectId);

  if (!resolved) {
    return null;
  }

  const { effect, index } = resolved;

  return (
    <div className="grid gap-2 pl-[44px]">
      <FieldRow label="X">
        <ScrubSlider
          ariaLabel="Shadow X"
          max={OFFSET_RANGE.max}
          min={OFFSET_RANGE.min}
          onScrubEnd={xHistory.onScrubEnd}
          onScrubStart={xHistory.onScrubStart}
          onValueChange={(x) => editor.updateEffect(index, { x })}
          scrubMax={Math.max(OFFSET_SCRUB_RANGE.max, effect.x)}
          scrubMin={Math.min(OFFSET_SCRUB_RANGE.min, effect.x)}
          value={effect.x}
        />
      </FieldRow>
      <FieldRow label="Y">
        <ScrubSlider
          ariaLabel="Shadow Y"
          max={OFFSET_RANGE.max}
          min={OFFSET_RANGE.min}
          onScrubEnd={yHistory.onScrubEnd}
          onScrubStart={yHistory.onScrubStart}
          onValueChange={(y) => editor.updateEffect(index, { y })}
          scrubMax={Math.max(OFFSET_SCRUB_RANGE.max, effect.y)}
          scrubMin={Math.min(OFFSET_SCRUB_RANGE.min, effect.y)}
          value={effect.y}
        />
      </FieldRow>
      <FieldRow label="Blur">
        <ScrubSlider
          ariaLabel="Shadow blur"
          max={BLUR_RANGE.max}
          min={BLUR_RANGE.min}
          onScrubEnd={blurHistory.onScrubEnd}
          onScrubStart={blurHistory.onScrubStart}
          onValueChange={(blur) => editor.updateEffect(index, { blur })}
          scrubMax={Math.max(BLUR_SCRUB_RANGE.max, effect.blur)}
          scrubMin={BLUR_SCRUB_RANGE.min}
          value={effect.blur}
        />
      </FieldRow>
    </div>
  );
};
