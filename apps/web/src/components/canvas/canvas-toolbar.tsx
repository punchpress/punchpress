import {
  Add01Icon,
  Cursor01Icon,
  Remove01Icon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { HandIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/ui/toolbar";
import { useEditor } from "../../editor/use-editor";
import { useEditorValue } from "../../editor/use-editor-value";

const TOOL_CONFIG = [
  {
    icon: Cursor01Icon,
    iconLibrary: "hugeicons",
    id: "pointer",
    label: "Pointer",
    shortcut: "V",
  },
  {
    icon: HandIcon,
    iconLibrary: "lucide",
    id: "hand",
    label: "Hand",
    shortcut: "H",
  },
  {
    icon: TextFontIcon,
    iconLibrary: "hugeicons",
    id: "text",
    label: "Text",
    shortcut: "T",
  },
];

export const CanvasToolbar = () => {
  const editor = useEditor();
  const activeTool = useEditorValue((_, state) => state.activeTool);
  const zoom = useEditorValue((_, state) => state.viewport.zoom);

  return (
    <Toolbar>
      <ToolbarGroup>
        {TOOL_CONFIG.map(({ icon, iconLibrary, id, label, shortcut }) => {
          const Icon = icon;

          return (
            <ToolbarButton
              aria-label={`${label} (${shortcut})`}
              key={id}
              render={
                <Toggle
                  aria-pressed={activeTool === id}
                  onPressedChange={(pressed) => {
                    if (pressed) {
                      editor.setActiveTool(id);
                    }
                  }}
                  pressed={activeTool === id}
                />
              }
              title={`${label} (${shortcut})`}
            >
              {iconLibrary === "lucide" ? (
                <Icon size={18} strokeWidth={1.8} />
              ) : (
                <HugeiconsIcon
                  color="currentColor"
                  icon={icon}
                  size={20}
                  strokeWidth={1.6}
                />
              )}
            </ToolbarButton>
          );
        })}
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ToolbarButton
          aria-label="Zoom out"
          onClick={() => editor.zoomOut()}
          render={<Button size="icon-sm" variant="ghost" />}
          title="Zoom out"
        >
          <HugeiconsIcon
            color="currentColor"
            icon={Remove01Icon}
            size={18}
            strokeWidth={1.8}
          />
        </ToolbarButton>
        <span className="min-w-10 select-none text-center text-muted-foreground text-xs tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <ToolbarButton
          aria-label="Zoom in"
          onClick={() => editor.zoomIn()}
          render={<Button size="icon-sm" variant="ghost" />}
          title="Zoom in"
        >
          <HugeiconsIcon
            color="currentColor"
            icon={Add01Icon}
            size={18}
            strokeWidth={1.8}
          />
        </ToolbarButton>
      </ToolbarGroup>
    </Toolbar>
  );
};
