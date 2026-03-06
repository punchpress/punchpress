import { LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { toNumber } from "../editor/math-utils";
import { getDefaultWarp } from "../editor/model";
import { ColorField, FieldRow, PairedRow, Section } from "./node-fields-shared";
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

        <PairedRow
          action={
            <Toggle
              aria-label="Link size and tracking"
              className="size-6 min-w-6 rounded-md"
              size="sm"
            >
              <LinkIcon className="size-3" />
            </Toggle>
          }
          label="Size"
        >
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
          <Input
            nativeInput
            onChange={(event) => {
              const tracking = toNumber(event.target.value, node.tracking);
              updateSelectedNode({ tracking });
            }}
            type="number"
            value={node.tracking}
          />
        </PairedRow>
      </Section>

      <Section className="border-black/6 border-t" title="Fill & Stroke">
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

      <Section className="border-black/6 border-t" title="Warp">
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

      <Section className="border-black/6 border-t" title="Position">
        <PairedRow label="Position">
          <Input
            nativeInput
            onChange={(event) =>
              updateSelectedNode({ x: toNumber(event.target.value, node.x) })
            }
            type="number"
            value={node.x}
          />
          <Input
            nativeInput
            onChange={(event) =>
              updateSelectedNode({ y: toNumber(event.target.value, node.y) })
            }
            type="number"
            value={node.y}
          />
        </PairedRow>
      </Section>

      <div className="border-black/6 border-t pt-3 [&_[data-slot=button]]:w-full">
        <Button
          onClick={deleteSelected}
          size="sm"
          type="button"
          variant="destructive-outline"
        >
          Delete
        </Button>
      </div>
    </>
  );
};
