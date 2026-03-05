import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { clamp, toNumber } from "../editor/math-utils";
import { FieldRow } from "./node-fields-shared";

export const NodeFieldsWarpInputs = ({ node, updateSelectedNode }) => {
  if (node.warp.kind === "arch") {
    const setBend = (value) => {
      const bend = clamp(toNumber(value, node.warp.bend), -1, 1);
      updateSelectedNode((currentNode) => {
        return {
          ...currentNode,
          warp: { ...currentNode.warp, bend },
        };
      });
    };

    return (
      <FieldRow label="Bend">
        <div className="range-pair">
          <Slider
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
              updateSelectedNode((currentNode) => {
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
              updateSelectedNode((currentNode) => {
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

  return (
    <>
      <FieldRow label="Radius">
        <Input
          nativeInput
          onChange={(event) => {
            const radius = Math.max(
              1,
              toNumber(event.target.value, node.warp.radius)
            );
            updateSelectedNode((currentNode) => {
              return {
                ...currentNode,
                warp: { ...currentNode.warp, radius },
              };
            });
          }}
          type="number"
          value={node.warp.radius}
        />
      </FieldRow>

      <FieldRow label="Sweep">
        <Input
          nativeInput
          onChange={(event) => {
            const sweepDeg = toNumber(event.target.value, node.warp.sweepDeg);
            updateSelectedNode((currentNode) => {
              return {
                ...currentNode,
                warp: { ...currentNode.warp, sweepDeg },
              };
            });
          }}
          type="number"
          value={node.warp.sweepDeg}
        />
      </FieldRow>
    </>
  );
};
