import { EditorShell } from "./components/editor/editor-shell";
import { EditorSessionProvider } from "./editor/state/editor-session-provider";
import { ThemeProvider } from "./theme/theme-provider";

export const App = () => {
  return (
    <ThemeProvider>
      <EditorSessionProvider>
        <EditorShell />
      </EditorSessionProvider>
    </ThemeProvider>
  );
};
