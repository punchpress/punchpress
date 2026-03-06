import { createContext, useContext } from "react";
import { useEditorSession } from "./use-editor-session";

const EditorSessionContext = createContext(null);

export const EditorSessionProvider = ({ children }) => {
  const session = useEditorSession();

  return (
    <EditorSessionContext.Provider value={session}>
      {children}
    </EditorSessionContext.Provider>
  );
};

export const useEditorSessionContext = () => {
  const session = useContext(EditorSessionContext);

  if (!session) {
    throw new Error(
      "useEditorSessionContext must be used within EditorSessionProvider"
    );
  }

  return session;
};
