import { useLayoutEffect } from "react";

export const useEditorModalBlocking = (isBlockingDialogOpen: boolean) => {
  useLayoutEffect(() => {
    const editorShell = document.querySelector("[data-editor-shell-root]");

    if (!(editorShell instanceof HTMLElement)) {
      return;
    }

    const previousPointerEvents = editorShell.style.pointerEvents;
    editorShell.inert = isBlockingDialogOpen;
    editorShell.style.pointerEvents = isBlockingDialogOpen
      ? "none"
      : previousPointerEvents;

    return () => {
      editorShell.inert = false;
      editorShell.style.pointerEvents = previousPointerEvents;
    };
  }, [isBlockingDialogOpen]);
};
