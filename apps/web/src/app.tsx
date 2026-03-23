import { EditorShell } from "./components/editor/editor-shell";
import { ToastProvider } from "./components/ui/toast";
import { TooltipProvider } from "./components/ui/tooltip";
import { EditorProvider } from "./editor-react/editor-provider";
import { PerformanceProvider } from "./performance/performance-provider";
import { ThemeProvider } from "./theme/theme-provider";

export const App = () => {
  return (
    <ThemeProvider>
      <TooltipProvider delay={0}>
        <ToastProvider>
          <EditorProvider>
            <PerformanceProvider>
              <EditorShell />
            </PerformanceProvider>
          </EditorProvider>
        </ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
};
