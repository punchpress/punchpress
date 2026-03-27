import {
  Add01Icon,
  Cursor01Icon,
  Remove01Icon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { HandIcon, PenToolIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/ui/toolbar";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorValue } from "../../editor-react/use-editor-value";
import { ShapeToolbarButton } from "./shape-toolbar-button";

const PRIMARY_TOOL_CONFIG = [
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
];

const TEXT_TOOL = {
  icon: TextFontIcon,
  iconLibrary: "hugeicons",
  id: "text",
  label: "Text",
  shortcut: "T",
};

const PEN_TOOL = {
  icon: PenToolIcon,
  iconLibrary: "lucide",
  id: "pen",
  label: "Pen",
  shortcut: "P",
};

export const CanvasToolbar = () => {
  const editor = useEditor();
  const zoom = useEditorValue((_, state) => state.viewport.zoom);

  return (
    <Toolbar className="canvas-bottom-toolbar">
      <ToolbarGroup>
        {PRIMARY_TOOL_CONFIG.map((tool) => {
          return <ToolButton key={tool.id} {...tool} />;
        })}
        <ToolButton {...PEN_TOOL} />
        <ToolButton {...TEXT_TOOL} />
        <ShapeToolbarButton />
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

const ToolButton = ({ icon, iconLibrary, id, label, shortcut }) => {
  const editor = useEditor();
  const activeTool = useEditorValue((_, state) => state.activeTool);
  const Icon = icon;

  return (
    <ToolbarButton
      aria-label={`${label} (${shortcut})`}
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
};
