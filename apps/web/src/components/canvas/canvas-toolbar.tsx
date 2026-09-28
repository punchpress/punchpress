import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArtboardToolIcon,
  Cursor01Icon,
  Cursor02Icon,
  Remove01Icon,
  TextFontIcon,
} from "@hugeicons-pro/core-stroke-rounded";
import { ARTBOARD_HEIGHT, ARTBOARD_WIDTH } from "@punchpress/engine";
import { BrushIcon, EraserIcon, HandIcon, PenToolIcon } from "lucide-react";
import type { CSSProperties } from "react";
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
import { CanvasZoomControl } from "./canvas-zoom-control";
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
    icon: Cursor02Icon,
    iconLibrary: "hugeicons",
    id: "node",
    label: "Node",
    shortcut: "A",
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
  iconSize: 25,
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

const BRUSH_TOOL = {
  icon: BrushIcon,
  iconLibrary: "lucide",
  id: "brush",
  label: "Brush",
  shortcut: "B",
};

const ERASER_TOOL = {
  icon: EraserIcon,
  iconLibrary: "lucide",
  id: "eraser",
  label: "Eraser",
  shortcut: "E",
};

const TOOL_CURSOR_BY_ID = {
  brush: "crosshair",
  eraser: "crosshair",
  hand: "var(--canvas-cursor-grab)",
  node: "var(--canvas-cursor-node)",
  pen: "var(--canvas-cursor-pen-tool)",
  pointer: "var(--canvas-cursor-default)",
  shape: "var(--canvas-cursor-add)",
  text: "text",
};

const addArtboardToCurrentView = (editor) => {
  const shouldFitArtboard = editor.nodes.every((node) => node.type === "empty");
  const viewportCenter = editor.getViewportCenter() || {
    x: ARTBOARD_WIDTH / 2,
    y: ARTBOARD_HEIGHT / 2,
  };
  const origin = {
    x: viewportCenter.x - ARTBOARD_WIDTH / 2,
    y: viewportCenter.y - ARTBOARD_HEIGHT / 2,
  };
  const nodeId = editor.addArtboardNode(origin);

  if (!nodeId) {
    return;
  }

  if (shouldFitArtboard) {
    editor.scheduleViewportFocus([nodeId], {
      paddingX: ARTBOARD_WIDTH * 0.1,
      paddingY: ARTBOARD_HEIGHT * 0.1,
    });
  }
};

export const CanvasToolbar = () => {
  const editor = useEditor();
  const activeTool = useEditorValue((_, state) => state.activeTool);
  const activeToolCursor =
    TOOL_CURSOR_BY_ID[activeTool] || TOOL_CURSOR_BY_ID.pointer;

  return (
    <Toolbar
      className="canvas-bottom-toolbar"
      style={
        {
          "--canvas-active-tool-cursor": activeToolCursor,
        } as CSSProperties
      }
    >
      <ToolbarGroup>
        {PRIMARY_TOOL_CONFIG.map((tool) => {
          return <ToolButton key={tool.id} {...tool} />;
        })}
        <ToolButton {...PEN_TOOL} />
        <ToolButton {...TEXT_TOOL} />
        <ShapeToolbarButton />
        <ToolButton {...BRUSH_TOOL} />
        <ToolButton {...ERASER_TOOL} />
        <ToolbarButton
          aria-label="Add artboard"
          onClick={() => addArtboardToCurrentView(editor)}
          render={<Button size="icon-sm" variant="ghost" />}
          title="Add artboard"
        >
          <HugeiconsIcon
            color="currentColor"
            icon={ArtboardToolIcon}
            size={21}
            strokeWidth={1.6}
          />
        </ToolbarButton>
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
        <CanvasZoomControl />
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

const ToolButton = ({ icon, iconLibrary, iconSize, id, label, shortcut }) => {
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
          size={iconSize ?? 20}
          strokeWidth={1.6}
        />
      )}
    </ToolbarButton>
  );
};
