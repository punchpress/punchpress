import { EditorShell } from "./components/editor/editor-shell";
import { ToastProvider } from "./components/ui/toast";
import { TooltipProvider } from "./components/ui/tooltip";
import { EditorProvider } from "./editor-react/editor-provider";
import { PerformanceProvider } from "./performance/performance-provider";
import { DesktopNativeMenuBridge } from "./platform/desktop-menu/desktop-native-menu-bridge";
import { ThemeProvider } from "./theme/theme-provider";

export const App = () => {
  return (
    <ThemeProvider>
      <TooltipProvider delay={0}>
        <ToastProvider>
          <EditorProvider>
            <PerformanceProvider>
              <DesktopNativeMenuBridge />
              <EditorShell />
            </PerformanceProvider>
          </EditorProvider>
        </ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
};
