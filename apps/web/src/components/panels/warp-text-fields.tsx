import {
  getDefaultWarp,
  getNodeX,
  getNodeY,
  toNumber,
} from "@punchpress/engine";
import {
  createLocalFontDescriptor,
  createLocalFontOption,
} from "@punchpress/punch-schema";
import { LinkIcon } from "lucide-react";
import { FontPicker } from "@/components/fonts-picker/font-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import {
  ToggleGroup,
  Toggle as ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorValue } from "../../editor-react/use-editor-value";
import { ColorField, FieldRow, PairedRow, Section } from "./field-primitives";
import { warpIcons } from "./warp-icons";
import { NodeFieldsWarpInputs } from "./warp-text-warp-fields";

export const NodeFields = () => {
  const editor = useEditor();
  const node = useEditorValue((editor) => editor.selectedNode);
  const availableFonts = useEditorValue((editor) => editor.availableFonts);
  const fontCatalogState = useEditorValue((editor) => editor.fontCatalogState);
  const fontCatalogError = useEditorValue((editor) => editor.bootstrapError);
  const hasPathGuide = useEditorValue((editor) => {
    if (!node) {
      return false;
    }

    return Boolean(editor.getNodeGeometry(node.id)?.guide);
  });

  if (!node) {
    return null;
  }

  const update = (changes) => editor.updateSelectedNode(changes);

  return (
    <>
      <Section title="Text">
        <FieldRow label="Text">
          <Input
            nativeInput
            onChange={(event) => update({ text: event.target.value })}
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
              update({ font: createLocalFontDescriptor(font) });
            }}
            state={fontCatalogState}
            stateMessage={fontCatalogError}
            value={createLocalFontOption(node.font)}
          />
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
              update({ fontSize });
            }}
            type="number"
            value={node.fontSize}
          />
          <Input
            nativeInput
            onChange={(event) => {
              const tracking = toNumber(event.target.value, node.tracking);
              update({ tracking });
            }}
            type="number"
            value={node.tracking}
          />
        </PairedRow>
      </Section>

      <Section className="border-black/6 border-t" title="Fill & Stroke">
        <FieldRow label="Fill">
          <ColorField onChange={(fill) => update({ fill })} value={node.fill} />
        </FieldRow>

        <FieldRow label="Stroke">
          <ColorField
            onChange={(stroke) => update({ stroke })}
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
              update({ strokeWidth });
            }}
            type="number"
            value={node.strokeWidth}
          />
        </FieldRow>
      </Section>

      <Section className="border-black/6 border-t" title="Warp">
        <ToggleGroup
          className="gap-1.5"
          onValueChange={(values) => {
            const next = values[0] ?? "none";
            update({ warp: getDefaultWarp(next) });

            if (next === "circle") {
              editor.startPathEditing(node.id);
              return;
            }

            if (editor.isPathEditing(node.id)) {
              editor.stopPathEditing();
            }
          }}
          value={node.warp.kind === "none" ? [] : [node.warp.kind]}
        >
          {(["arch", "wave", "circle", "slant"] as const).map((kind) => {
            const { icon: Icon, label } = warpIcons[kind];
            const isSlant = kind === "slant";
            return (
              <ToggleGroupItem
                aria-label={label}
                className={cn(
                  "[&_svg]:!size-7 h-auto flex-1 px-0 py-2",
                  isSlant && "cursor-not-allowed opacity-20"
                )}
                disabled={isSlant}
                key={kind}
                title={isSlant ? "Slant (coming soon)" : label}
                value={kind}
              >
                <Icon />
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>

        <NodeFieldsWarpInputs />

        {node.warp.kind !== "none" && (
          <button
            className="w-full text-center text-[11px] text-foreground/40 transition-colors hover:text-foreground/70"
            onClick={() => update({ warp: getDefaultWarp("none") })}
            type="button"
          >
            Clear
          </button>
        )}
      </Section>

      <Section className="border-black/6 border-t" title="Position">
        <PairedRow label="Position">
          <Input
            nativeInput
            onChange={(event) =>
              update({
                transform: {
                  x: toNumber(event.target.value, getNodeX(node)),
                },
              })
            }
            type="number"
            value={getNodeX(node)}
          />
          <Input
            nativeInput
            onChange={(event) =>
              update({
                transform: {
                  y: toNumber(event.target.value, getNodeY(node)),
                },
              })
            }
            type="number"
            value={getNodeY(node)}
          />
        </PairedRow>
      </Section>

      {hasPathGuide ? null : (
        <div className="border-black/6 border-t pt-3 [&_[data-slot=button]]:w-full">
          <Button
            onClick={() => editor.deleteSelected()}
            size="sm"
            type="button"
            variant="destructive-outline"
          >
            Delete
          </Button>
        </div>
      )}
    </>
  );
};
