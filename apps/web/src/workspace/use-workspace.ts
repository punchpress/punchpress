import { useContext } from "react";
import { WorkspaceContext } from "./workspace-context";

export const useWorkspace = () => {
  const workspace = useContext(WorkspaceContext);

  if (!workspace) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  }

  return workspace;
};
