import { useEffect, useEffectEvent } from "react";
import { useElectronIpcEvent } from "@/hooks/use-electron-ipc-event";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorValue } from "../../editor-react/use-editor-value";
import type {
  DesktopEditorCommand,
} from "./desktop-native-menu-types";
import { getDesktopAppMenuState } from "./desktop-native-menu-state";

export const DesktopNativeMenuBridge = () => {
  const editor = useEditor();
  const menuState = useEditorValue((editor, state) =>
    getDesktopAppMenuState(editor, state.selectedNodeIds)
  );

  useEffect(() => {
    window.electron?.appMenu?.updateState(menuState);
  }, [menuState]);

  const handleEditorCommand = useEffectEvent(
    (command: DesktopEditorCommand) => {
      if (command.type === "history") {
        if (command.action === "undo") {
          editor.undo();
          return;
        }

        editor.redo();
        return;
      }

      if (command.type === "selection") {
        if (command.action === "delete-selected") {
          editor.deleteSelected();
          return;
        }

        editor.togglePathEditing();
        return;
      }

      editor.setSelectionProperty(command.propertyId, command.value);
    }
  );

  useElectronIpcEvent(window.electron?.editorCommands?.onCommand, (command) => {
    handleEditorCommand(command);
  });

  return null;
};
