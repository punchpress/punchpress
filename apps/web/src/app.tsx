import { EditorShell } from "./components/editor/editor-shell";
import { MergeCurvesProvider } from "./components/editor/merge-curves-confirmation";
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
              <MergeCurvesProvider>
                <DesktopNativeMenuBridge />
                <EditorShell />
              </MergeCurvesProvider>
            </PerformanceProvider>
          </WorkspaceProvider>
        </ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
};
