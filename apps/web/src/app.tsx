import { EditorShell } from "./components/editor/editor-shell";
import { EditorProvider } from "./editor/editor-provider";
import { ThemeProvider } from "./theme/theme-provider";

export const App = () => {
  return (
    <ThemeProvider>
      <EditorProvider>
        <EditorShell />
      </EditorProvider>
    </ThemeProvider>
  );
};
