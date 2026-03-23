import { useEditor } from "../../editor-react/use-editor";
import { Canvas } from "../canvas/canvas";
import {
  Designer,
  DesignerCanvas,
  DesignerContent,
  DesignerPanel,
  DesignerWindowDragRegion,
} from "../designer/designer";
import { LayersPanel } from "../panels/layers-panel/layers-panel";
import { PropertiesPanel } from "../panels/properties-panel";
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
  const isDesktopShell =
    typeof window !== "undefined" && Boolean(window.electron?.versions);
  const shellChromeVars = isDesktopShell
    ? SHELL_CHROME_VARS.desktop
    : SHELL_CHROME_VARS.web;

  return (
    <Designer
      data-editor-shell-root=""
      style={{
        ...shellChromeVars,
        "--editor-accent": editor.accent,
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
