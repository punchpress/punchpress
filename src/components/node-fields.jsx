import { toNumber } from "../editor/math-utils";
import { getDefaultWarp } from "../editor/model";
import { ColorField, FieldRow, Section } from "./node-fields-shared";
import { NodeFieldsWarpInputs } from "./node-fields-warp-inputs";

export const NodeFields = ({
  deleteSelected,
  fonts,
  node,
  updateSelectedNode,
}) => {
  return (
    <>
      <Section title="Text">
        <FieldRow label="Text">
          <input
            onChange={(event) =>
              updateSelectedNode({ text: event.target.value })
            }
            value={node.text}
          />
        </FieldRow>

        <FieldRow label="Font">
          <div className="select-wrap">
            <select
              onChange={(event) =>
                updateSelectedNode({ fontUrl: event.target.value })
              }
              value={node.fontUrl}
            >
              {fonts.map((font) => {
                return (
                  <option key={font.id} value={font.url}>
                    {font.label}
                  </option>
                );
              })}
            </select>
          </div>
        </FieldRow>

        <div className="field-pair">
          <FieldRow label="Size">
            <input
              onChange={(event) => {
                const fontSize = Math.max(
                  1,
                  toNumber(event.target.value, node.fontSize)
                );
                updateSelectedNode({ fontSize });
              }}
              type="number"
              value={node.fontSize}
            />
          </FieldRow>

          <FieldRow label="Track">
            <input
              onChange={(event) => {
                const tracking = toNumber(event.target.value, node.tracking);
                updateSelectedNode({ tracking });
              }}
              type="number"
              value={node.tracking}
            />
          </FieldRow>
        </div>
      </Section>

      <Section title="Fill & Stroke">
        <FieldRow label="Fill">
          <ColorField
            onChange={(fill) => updateSelectedNode({ fill })}
            value={node.fill}
          />
        </FieldRow>

        <FieldRow label="Stroke">
          <ColorField
            onChange={(stroke) => updateSelectedNode({ stroke })}
            value={node.stroke}
          />
        </FieldRow>

        <FieldRow label="Width">
          <input
            onChange={(event) => {
              const strokeWidth = Math.max(
                0,
                toNumber(event.target.value, node.strokeWidth)
              );
              updateSelectedNode({ strokeWidth });
            }}
            type="number"
            value={node.strokeWidth}
          />
        </FieldRow>
      </Section>

      <Section title="Warp">
        <FieldRow label="Type">
          <div className="select-wrap">
            <select
              onChange={(event) => {
                updateSelectedNode({
                  warp: getDefaultWarp(event.target.value),
                });
              }}
              value={node.warp.kind}
            >
              <option value="none">None</option>
              <option value="arch">Arch</option>
              <option value="wave">Wave</option>
              <option value="circle">Circle</option>
            </select>
          </div>
        </FieldRow>

        <NodeFieldsWarpInputs
          node={node}
          updateSelectedNode={updateSelectedNode}
        />
      </Section>

      <Section title="Position">
        <div className="field-pair">
          <FieldRow label="X">
            <input
              onChange={(event) =>
                updateSelectedNode({ x: toNumber(event.target.value, node.x) })
              }
              type="number"
              value={node.x}
            />
          </FieldRow>

          <FieldRow label="Y">
            <input
              onChange={(event) =>
                updateSelectedNode({ y: toNumber(event.target.value, node.y) })
              }
              type="number"
              value={node.y}
            />
          </FieldRow>
        </div>
      </Section>

      <button className="delete-button" onClick={deleteSelected} type="button">
        Delete
      </button>
    </>
  );
};
