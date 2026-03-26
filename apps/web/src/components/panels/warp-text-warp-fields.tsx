import { clamp, toNumber } from "@punchpress/engine";
import { Input } from "@/components/ui/input";
import { ScrubSlider } from "@/components/ui/scrub-slider";
import { Slider } from "@/components/ui/slider";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorValue } from "../../editor-react/use-editor-value";
import { FieldRow } from "./field-primitives";

const CIRCLE_RADIUS_RANGE = { min: 1, max: 5000 };
const CIRCLE_SWEEP_RANGE = { min: -360, max: 360 };

export const NodeFieldsWarpInputs = () => {
  const editor = useEditor();
  const node = useEditorValue((editor) => editor.selectedNode);

  if (!node) {
    return null;
  }

  const update = (updater) => editor.updateSelectedNode(updater);

  if (node.warp.kind === "arch") {
    const setBend = (value) => {
      const bend = clamp(toNumber(value, node.warp.bend), -1, 1);
      update((currentNode) => {
        return {
          ...currentNode,
          warp: { ...currentNode.warp, bend },
        };
      });
    };

    return (
      <FieldRow label="Bend">
        <div className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-2">
          <Slider
            className="min-w-0"
            max={1}
            min={-1}
            onValueChange={(value) => {
              const next = Array.isArray(value) ? value[0] : value;
              setBend(next);
            }}
            step={0.01}
            value={node.warp.bend}
          />
          <Input
            max={1}
            min={-1}
            nativeInput
            onChange={(event) => {
              setBend(event.target.value);
            }}
            step={0.01}
            type="number"
            value={node.warp.bend}
          />
        </div>
      </FieldRow>
    );
  }

  if (node.warp.kind === "wave") {
    return (
      <>
        <FieldRow label="Amplitude">
          <Input
            nativeInput
            onChange={(event) => {
              const amplitude = toNumber(
                event.target.value,
                node.warp.amplitude
              );
              update((currentNode) => {
                return {
                  ...currentNode,
                  warp: { ...currentNode.warp, amplitude },
                };
              });
            }}
            type="number"
            value={node.warp.amplitude}
          />
        </FieldRow>

        <FieldRow label="Cycles">
          <Input
            min={0.1}
            nativeInput
            onChange={(event) => {
              const cycles = Math.max(
                0.1,
                toNumber(event.target.value, node.warp.cycles)
              );
              update((currentNode) => {
                return {
                  ...currentNode,
                  warp: { ...currentNode.warp, cycles },
                };
              });
            }}
            step={0.1}
            type="number"
            value={node.warp.cycles}
          />
        </FieldRow>
      </>
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
