import { useEditor } from "../../editor/use-editor";
import { Canvas } from "../canvas/canvas";
import {
  Designer,
  DesignerCanvas,
  DesignerContent,
  DesignerPanel,
  DesignerWindowDragRegion,
} from "../designer/designer";
import { LayersPanel } from "../panels/layers-panel";
import { PropertiesPanel } from "../panels/properties-panel";

const SHELL_CHROME_VARS = {
  desktop: {
    "--desktop-chrome-height": "40px",
    "--desktop-drag-left-inset": "72px",
    "--desktop-panel-top-gap": "4px",
    "--shell-logo-offset-x": "-7px",
  },
  web: {
    "--desktop-chrome-height": "0px",
    "--desktop-drag-left-inset": "0px",
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
      style={{
        ...shellChromeVars,
        "--editor-accent": editor.accent,
      }}
    >
      <DesignerContent>
        {isDesktopShell ? <DesignerWindowDragRegion /> : null}

        <DesignerCanvas>
          <Canvas />
        </DesignerCanvas>

        <DesignerPanel side="left">
          <LayersPanel />
        </DesignerPanel>

        <DesignerPanel side="right">
          <PropertiesPanel />
        </DesignerPanel>
      </DesignerContent>
    </Designer>
  );
};
