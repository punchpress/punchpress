import { useEffect, useEffectEvent } from "react";
import { useElectronIpcEvent } from "@/hooks/use-electron-ipc-event";
import type { PunchOpenedDocumentFile } from "@/platform/web-document-files";
import { shouldIgnoreGlobalShortcutTarget } from "../../../editor/primitives/dom";
import type { DocumentCommand } from "./document-command-utils";
import { getDocumentCommandFromKeyEvent } from "./document-command-utils";

type ElectronDocumentCommands = NonNullable<
  Window["electron"]
>["documentCommands"];

interface UseDocumentCommandTriggersProps {
  confirmQuittingDirtyDocument: () => Promise<boolean>;
  confirmReplacingDirtyDocument: () => Promise<boolean>;
  electronDocumentCommands: ElectronDocumentCommands | undefined;
  finishOpenedDocument: (
    openedDocument: PunchOpenedDocumentFile | null
  ) => Promise<void>;
  handleActionError: (command: DocumentCommand, error: unknown) => void;
  isDocumentDirty: () => boolean;
  refreshRecentDocuments: () => Promise<void>;
  runDocumentCommandSafely: (command: DocumentCommand) => void;
}

export const useDocumentCommandTriggers = ({
  confirmQuittingDirtyDocument,
  confirmReplacingDirtyDocument,
  electronDocumentCommands,
  finishOpenedDocument,
  handleActionError,
  isDocumentDirty,
  refreshRecentDocuments,
  runDocumentCommandSafely,
}: UseDocumentCommandTriggersProps) => {
  const handleDocumentCommand = useEffectEvent(runDocumentCommandSafely);
  const handleDocumentError = useEffectEvent(handleActionError);
  const handleRefreshRecentDocuments = useEffectEvent(refreshRecentDocuments);
  const handleIsDocumentDirty = useEffectEvent(isDocumentDirty);

  useElectronIpcEvent(electronDocumentCommands?.onCommand, (command) => {
    runDocumentCommandSafely(command);
  });

  useElectronIpcEvent(electronDocumentCommands?.onBeforeClose, (requestId) => {
    confirmQuittingDirtyDocument()
      .then((shouldClose) => {
        electronDocumentCommands?.respondBeforeClose(requestId, shouldClose);
      })
      .catch((error) => {
        console.error(error);
        electronDocumentCommands?.respondBeforeClose(requestId, false);
      });
  });

  useElectronIpcEvent(
    electronDocumentCommands?.onOpenDocument,
    (openedDocument) => {
      confirmReplacingDirtyDocument()
        .then((shouldReplace) => {
          if (!shouldReplace) {
            return;
          }

          return finishOpenedDocument(openedDocument);
        })
        .catch((error) => {
          handleActionError("open", error);
        });
    }
  );

  useElectronIpcEvent(
    electronDocumentCommands?.onRecentDocumentsChanged,
    () => {
      refreshRecentDocuments().catch((error) => {
        handleActionError("open", error);
      });
    }
  );

  useEffect(() => {
    if (window.electron?.documentCommands) {
      return;
    }

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreGlobalShortcutTarget(event.target)) {
        return;
      }

      const command = getDocumentCommandFromKeyEvent(event);

      if (!command) {
        return;
      }

      event.preventDefault();
      handleDocumentCommand(command);
    };

    window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, []);

  useEffect(() => {
    electronDocumentCommands?.markReady?.();
  }, [electronDocumentCommands]);

  useEffect(() => {
    handleRefreshRecentDocuments().catch((error) => {
      handleDocumentError("open", error);
    });
  }, []);

  useEffect(() => {
    if (window.electron?.versions) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!handleIsDocumentDirty()) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);
};
