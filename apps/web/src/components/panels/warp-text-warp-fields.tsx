import {
  ARCH_BEND_LIMIT,
  clamp,
  toNumber,
  WAVE_CYCLES_MAX,
  WAVE_CYCLES_MIN,
} from "@punchpress/engine";
import { ScrubSlider } from "@/components/ui/scrub-slider";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorValue } from "../../editor-react/use-editor-value";
import { FieldRow } from "./field-primitives";

const ARCH_BEND_RANGE = { min: -ARCH_BEND_LIMIT, max: ARCH_BEND_LIMIT };
const CIRCLE_RADIUS_RANGE = { min: 1, max: 5000 };
const CIRCLE_SWEEP_RANGE = { min: -360, max: 360 };
const WAVE_AMPLITUDE_RANGE = { min: -500, max: 500 };
const WAVE_CYCLES_RANGE = { min: WAVE_CYCLES_MIN, max: WAVE_CYCLES_MAX };
const SLANT_RISE_RANGE = { min: -400, max: 400 };

export const NodeFieldsWarpInputs = () => {
  const editor = useEditor();
  const node = useEditorValue((editor) => editor.selectedNode);

  if (!node) {
    return null;
  }

  const update = (updater) => editor.updateSelectedNode(updater);

  if (node.warp.kind === "arch") {
    const setBend = (value) => {
      const bend = clamp(
        toNumber(value, node.warp.bend),
        -ARCH_BEND_LIMIT,
        ARCH_BEND_LIMIT
      );
      update((currentNode) => {
        return {
          ...currentNode,
          warp: { ...currentNode.warp, bend },
        };
      });
    };

    return (
      <FieldRow label="Bend">
        <ScrubSlider
          ariaLabel="Bend"
          max={ARCH_BEND_RANGE.max}
          min={ARCH_BEND_RANGE.min}
          onValueChange={setBend}
          step={0.01}
          value={node.warp.bend}
        />
      </FieldRow>
    );
  }

  if (node.warp.kind === "wave") {
    const setAmplitude = (value) => {
      const amplitude = clamp(
        toNumber(value, node.warp.amplitude),
        WAVE_AMPLITUDE_RANGE.min,
        WAVE_AMPLITUDE_RANGE.max
      );
      update((currentNode) => {
        return {
          ...currentNode,
          warp: { ...currentNode.warp, amplitude },
        };
      });
    };

    const setCycles = (value) => {
      const cycles = clamp(
        toNumber(value, node.warp.cycles),
        WAVE_CYCLES_RANGE.min,
        WAVE_CYCLES_RANGE.max
      );
      update((currentNode) => {
        return {
          ...currentNode,
          warp: { ...currentNode.warp, cycles },
        };
      });
    };

    return (
      <>
        <FieldRow label="Amplitude">
          <ScrubSlider
            ariaLabel="Amplitude"
            max={WAVE_AMPLITUDE_RANGE.max}
            min={WAVE_AMPLITUDE_RANGE.min}
            onValueChange={setAmplitude}
            step={1}
            value={node.warp.amplitude}
          />
        </FieldRow>

        <FieldRow label="Cycles">
          <ScrubSlider
            ariaLabel="Cycles"
            max={WAVE_CYCLES_RANGE.max}
            min={WAVE_CYCLES_RANGE.min}
            onValueChange={setCycles}
            step={0.1}
            value={node.warp.cycles}
          />
        </FieldRow>
      </>
    );
  }

  if (node.warp.kind === "slant") {
    const setRise = (value) => {
      const rise = clamp(
        toNumber(value, node.warp.rise),
        SLANT_RISE_RANGE.min,
        SLANT_RISE_RANGE.max
      );
      update((currentNode) => {
        return {
          ...currentNode,
          warp: { ...currentNode.warp, rise },
        };
      });
    };

    return (
      <FieldRow label="Slant">
        <ScrubSlider
          ariaLabel="Slant"
          max={SLANT_RISE_RANGE.max}
          min={SLANT_RISE_RANGE.min}
          onValueChange={setRise}
          step={1}
          value={node.warp.rise}
        />
      </FieldRow>
    );
  }

  if (node.warp.kind !== "circle") {
    return null;
  }

  const setRadius = (value) => {
    const radius = Math.max(1, toNumber(value, node.warp.radius));
    update((currentNode) => {
      return {
        ...currentNode,
        warp: { ...currentNode.warp, radius },
      };
    });
  };

  const setSweep = (value) => {
    const sweepDeg = toNumber(value, node.warp.sweepDeg);
    update((currentNode) => {
      return {
        ...currentNode,
        warp: { ...currentNode.warp, sweepDeg },
      };
    });
  };

  return (
    <>
      <FieldRow label="Radius">
        <ScrubSlider
          ariaLabel="Radius"
          max={CIRCLE_RADIUS_RANGE.max}
          min={CIRCLE_RADIUS_RANGE.min}
          onValueChange={setRadius}
          step={1}
          value={node.warp.radius}
        />
      </FieldRow>

      <FieldRow label="Sweep">
        <ScrubSlider
          ariaLabel="Sweep"
          max={CIRCLE_SWEEP_RANGE.max}
          min={CIRCLE_SWEEP_RANGE.min}
          onValueChange={setSweep}
          step={1}
          value={node.warp.sweepDeg}
        />
      </FieldRow>
    </>
  );
};
