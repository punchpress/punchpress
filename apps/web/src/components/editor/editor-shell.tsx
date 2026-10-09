import { useEffect } from "react";
import { NewFileDialog } from "@/workspace/new-file-dialog";
import { WorkspaceTabs } from "@/workspace/workspace-tabs";
import { useEditor } from "../../editor-react/use-editor";
import { useTheme } from "../../theme/theme-provider";
import { Canvas } from "../canvas/canvas";
import { getCanvasCursorStyle } from "../canvas/canvas-cursor-assets";
import { CommandMenu } from "../command-menu/command-menu";
import {
  Designer,
  DesignerCanvas,
  DesignerContent,
  DesignerPanel,
  DesignerTitleBar,
} from "../designer/designer";
import { useDocumentCommands } from "../panels/document-commands/use-document-commands";
import { LayersPanel } from "../panels/layers-panel/layers-panel";
import { MissingFontsExportDialog } from "../panels/missing-fonts-export-dialog";
import { PropertiesPanel } from "../panels/properties/properties-panel";
import { UnsavedDocumentDialog } from "../panels/unsaved-document-dialog";
import { PerformanceHud } from "../performance/performance-hud";
import { DesktopUpdateIndicator } from "./desktop-update-indicator";

const SHELL_CHROME_VARS = {
  desktop: {
    "--desktop-chrome-height": "40px",
    "--desktop-drag-left-inset": "84px",
    "--desktop-panel-top-gap": "4px",
    "--shell-logo-offset-x": "-7px",
    // Centers title bar content on the traffic lights: Electron places them
    // at y 16 and they are 14px tall, a 23px center; padding the 40px bar's
    // segments by 6px moves their content center from 20px to 23px.
    "--titlebar-inset-top": "6px",
  },
  web: {
    "--desktop-chrome-height": "40px",
    "--desktop-drag-left-inset": "0px",
    "--desktop-panel-top-gap": "16px",
    "--shell-logo-offset-x": "-7px",
    "--titlebar-inset-top": "0px",
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
  const documentCommands = useDocumentCommands();

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

  useEffect(() => {
    const preventBrowserPinchZoom = (event: WheelEvent) => {
      if (
        event.ctrlKey &&
        event.target instanceof Element &&
        event.target.closest("[data-editor-shell-root]")
      ) {
        event.preventDefault();
      }
    };

    document.addEventListener("wheel", preventBrowserPinchZoom, {
      capture: true,
      passive: false,
    });

    return () => {
      document.removeEventListener("wheel", preventBrowserPinchZoom, true);
    };
  }, []);

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
        <DesignerTitleBar>
          <WorkspaceTabs
            onCloseTab={documentCommands.closeTabSafely}
            onNewFile={() => documentCommands.runDocumentCommandSafely("new")}
          />
          <DesktopUpdateIndicator />
        </DesignerTitleBar>

        <DesignerCanvas>
          <Canvas />
        </DesignerCanvas>

        <DesignerPanel side="left">
          <LayersPanel documentCommands={documentCommands} />
        </DesignerPanel>

        <DesignerPanel side="right">
          <PropertiesPanel />
        </DesignerPanel>

        <PerformanceHud />
        <CommandMenu />
      </DesignerContent>
      <NewFileDialog {...documentCommands.newFileDialogProps} />
      <MissingFontsExportDialog
        {...documentCommands.missingFontsExportDialogProps}
      />
      <UnsavedDocumentDialog {...documentCommands.unsavedDocumentDialogProps} />
    </Designer>
  );
};
