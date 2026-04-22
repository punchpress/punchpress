import { useEffect, useEffectEvent } from "react";
import { useElectronIpcEvent } from "@/hooks/use-electron-ipc-event";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorValue } from "../../editor-react/use-editor-value";
import { getDesktopCompoundVectorSelection } from "./desktop-native-menu-compound";
import { getDesktopAppMenuState } from "./desktop-native-menu-state";
import type { DesktopEditorCommand } from "./desktop-native-menu-types";

const handleHistoryCommand = (editor, command: DesktopEditorCommand) => {
  if (command.type !== "history") {
    return false;
  }

  if (command.action === "undo") {
    editor.undo();
    return true;
  }

  editor.redo();
  return true;
};

const handleCompoundOperationCommand = (
  editor,
  command: DesktopEditorCommand
) => {
  if (command.type !== "vector-compound-operation") {
    return false;
  }

  const compoundSelection = getDesktopCompoundVectorSelection(editor);

  if (compoundSelection) {
    editor.setVectorPathComposition(compoundSelection.nodeId, command.value);
  }

  return true;
};

const handleSelectionCommand = (editor, command: DesktopEditorCommand) => {
  if (command.type !== "selection") {
    return false;
  }

  if (command.action === "delete-selected") {
    editor.deleteSelected();
    return true;
  }

  if (command.action === "make-compound-path") {
    editor.makeCompoundPath();
    return true;
  }

  if (command.action === "release-compound-path") {
    editor.releaseCompoundPath();
    return true;
  }

  editor.togglePathEditing();
  return true;
};

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
      if (
        handleHistoryCommand(editor, command) ||
        handleCompoundOperationCommand(editor, command) ||
        handleSelectionCommand(editor, command)
      ) {
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
