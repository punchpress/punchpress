import { EditorShell } from "./components/editor/editor-shell";
import { ToastProvider } from "./components/ui/toast";
import { EditorProvider } from "./editor-react/editor-provider";
import { ThemeProvider } from "./theme/theme-provider";

export const App = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <EditorProvider>
          <EditorShell />
        </EditorProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};
