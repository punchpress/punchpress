import { EditorShell } from "./components/editor/editor-shell";
import { ToastProvider } from "./components/ui/toast";
import { TooltipProvider } from "./components/ui/tooltip";
import { PerformanceProvider } from "./performance/performance-provider";
import { DesktopNativeMenuBridge } from "./platform/desktop-menu/desktop-native-menu-bridge";
import { ThemeProvider } from "./theme/theme-provider";
import { WorkspaceProvider } from "./workspace/workspace-provider";

export const App = () => {
  return (
    <ThemeProvider>
      <TooltipProvider delay={0}>
        <ToastProvider>
          <WorkspaceProvider>
            <PerformanceProvider>
              <DesktopNativeMenuBridge />
              <EditorShell />
            </PerformanceProvider>
          </WorkspaceProvider>
        </ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
};
