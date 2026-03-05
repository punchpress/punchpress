import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
          <Input
            nativeInput
            onChange={(event) =>
              updateSelectedNode({ text: event.target.value })
            }
            value={node.text}
          />
        </FieldRow>

        <FieldRow label="Font">
          <Select
            onValueChange={(value) => {
              if (value) {
                updateSelectedNode({ fontUrl: value });
              }
            }}
            value={node.fontUrl}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fonts.map((font) => {
                return (
                  <SelectItem key={font.id} value={font.url}>
                    {font.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </FieldRow>

        <div className="field-pair">
          <FieldRow label="Size">
            <Input
              nativeInput
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
            <Input
              nativeInput
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
          <Input
            nativeInput
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
          <Select
            onValueChange={(value) => {
              if (value) {
                updateSelectedNode({
                  warp: getDefaultWarp(value),
                });
              }
            }}
            value={node.warp.kind}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="arch">Arch</SelectItem>
              <SelectItem value="wave">Wave</SelectItem>
              <SelectItem value="circle">Circle</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>

        <NodeFieldsWarpInputs
          node={node}
          updateSelectedNode={updateSelectedNode}
        />
      </Section>

      <Section title="Position">
        <div className="field-pair">
          <FieldRow label="X">
            <Input
              nativeInput
              onChange={(event) =>
                updateSelectedNode({ x: toNumber(event.target.value, node.x) })
              }
              type="number"
              value={node.x}
            />
          </FieldRow>

          <FieldRow label="Y">
            <Input
              nativeInput
              onChange={(event) =>
                updateSelectedNode({ y: toNumber(event.target.value, node.y) })
              }
              type="number"
              value={node.y}
            />
          </FieldRow>
        </div>
      </Section>

      <div className="delete-button-wrap">
        <Button
          onClick={deleteSelected}
          type="button"
          variant="destructive-outline"
        >
          Delete
        </Button>
      </div>
    </>
  );
};
