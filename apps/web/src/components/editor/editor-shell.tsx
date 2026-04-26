import { useEffect } from "react";
import { useEditor } from "../../editor-react/use-editor";
import { useTheme } from "../../theme/theme-provider";
import { Canvas } from "../canvas/canvas";
import { getCanvasCursorStyle } from "../canvas/canvas-cursor-assets";
import {
  Designer,
  DesignerCanvas,
  DesignerContent,
  DesignerPanel,
  DesignerWindowDragRegion,
} from "../designer/designer";
import { LayersPanel } from "../panels/layers-panel/layers-panel";
import { PropertiesPanel } from "../panels/properties/properties-panel";
import { PerformanceHud } from "../performance/performance-hud";
import { DesktopUpdateIndicator } from "./desktop-update-indicator";

const SHELL_CHROME_VARS = {
  desktop: {
    "--desktop-chrome-height": "40px",
    "--desktop-drag-left-inset": "72px",
    "--desktop-update-indicator-left": "16px",
    "--desktop-update-indicator-top": "14.5px",
    "--desktop-panel-top-gap": "4px",
    "--shell-logo-offset-x": "-7px",
  },
  web: {
    "--desktop-chrome-height": "0px",
    "--desktop-drag-left-inset": "0px",
    "--desktop-update-indicator-left": "8px",
    "--desktop-update-indicator-top": "8px",
    "--desktop-panel-top-gap": "16px",
    "--shell-logo-offset-x": "-7px",
  },
};

export const EditorShell = () => {
  const editor = useEditor();
  useTheme();
  const isDesktopShell =
    typeof window !== "undefined" && Boolean(window.electron?.versions);
  const shellChromeVars = isDesktopShell
    ? SHELL_CHROME_VARS.desktop
    : SHELL_CHROME_VARS.web;
  const cursorStyle = getCanvasCursorStyle();

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    const previousValues = new Map<string, string>();

    for (const [name, value] of Object.entries(cursorStyle)) {
      if (typeof value !== "string") {
        continue;
      }

      previousValues.set(name, root.style.getPropertyValue(name));
      root.style.setProperty(name, value);
    }

    return () => {
      for (const [name, value] of previousValues) {
        if (value) {
          root.style.setProperty(name, value);
        } else {
          root.style.removeProperty(name);
        }
      }
    };
  }, [cursorStyle]);

  return (
    <Designer
      data-editor-shell-root=""
      style={{
        ...cursorStyle,
        ...shellChromeVars,
        "--editor-accent": editor.accent,
        cursor: "var(--canvas-cursor-default)",
      }}
    >
      <DesignerContent>
        {isDesktopShell ? (
          <DesignerWindowDragRegion>
            <DesktopUpdateIndicator />
          </DesignerWindowDragRegion>
        ) : null}

        <DesignerCanvas>
          <Canvas />
        </DesignerCanvas>

        <DesignerPanel side="left">
          <LayersPanel />
        </DesignerPanel>

        <DesignerPanel side="right">
          <PropertiesPanel />
        </DesignerPanel>

        <PerformanceHud />
      </DesignerContent>
    </Designer>
  );
};
