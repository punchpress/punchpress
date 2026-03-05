import { clamp, toNumber } from "../editor/math-utils";
import { FieldRow } from "./node-fields-shared";

export const NodeFieldsWarpInputs = ({ node, updateSelectedNode }) => {
  if (node.warp.kind === "arch") {
    return (
      <FieldRow label="Bend">
        <div className="range-pair">
          <input
            max={1}
            min={-1}
            onChange={(event) => {
              const bend = clamp(
                toNumber(event.target.value, node.warp.bend),
                -1,
                1
              );
              updateSelectedNode((currentNode) => {
                return {
                  ...currentNode,
                  warp: { ...currentNode.warp, bend },
                };
              });
            }}
            step={0.01}
            type="range"
            value={node.warp.bend}
          />
          <input
            max={1}
            min={-1}
            onChange={(event) => {
              const bend = clamp(
                toNumber(event.target.value, node.warp.bend),
                -1,
                1
              );
              updateSelectedNode((currentNode) => {
                return {
                  ...currentNode,
                  warp: { ...currentNode.warp, bend },
                };
              });
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
          <input
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
          <input
            min={0.1}
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
        <input
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
        <input
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
