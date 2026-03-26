import {
  isInputElement,
  shouldIgnoreGlobalShortcutTarget,
} from "../primitives/dom";

export const handleEditingShortcutKeyDown = (editor, event, key) => {
  if ((event.metaKey || event.ctrlKey) && !event.altKey && key === "z") {
    event.preventDefault();

    if (event.shiftKey) {
      editor.redo();
      return true;
    }

    editor.undo();
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && !event.altKey && key === "y") {
    event.preventDefault();
    editor.redo();
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && !event.altKey && key === "j") {
    if (editor.selectedNodeIds.length === 0) {
      return true;
    }

    event.preventDefault();
    editor.duplicate();
    return true;
  }

  return false;
};

export const handleCanvasShortcutKeyDown = (editor, event, key) => {
  if ((event.metaKey || event.ctrlKey) && !event.altKey && key === "g") {
    event.preventDefault();

    if (event.shiftKey) {
      editor.ungroup();
      return true;
    }

    editor.groupSelected();
    return true;
  }

  if (event.metaKey || event.ctrlKey || event.altKey) {
    return false;
  }

  if (key === "escape" && editor.pathEditingNodeId) {
    event.preventDefault();
    editor.stopPathEditing();
    return true;
  }

  if (key === "e" && editor.canStartPathEditing()) {
    event.preventDefault();
    editor.togglePathEditing();
    return true;
  }

  if (event.code === "BracketLeft") {
    if (editor.selectedNodeIds.length === 0) {
      return true;
    }

    event.preventDefault();
    editor.sendToBack();
    return true;
  }

  if (event.code === "BracketRight") {
    if (editor.selectedNodeIds.length === 0) {
      return true;
    }

    event.preventDefault();
    editor.bringToFront();
    return true;
  }

  if (key === "backspace" || key === "delete") {
    event.preventDefault();
    editor.deleteSelected();
    return true;
  }

  return false;
};

export const handleWindowKeyDown = (editor, event) => {
  if (shouldIgnoreGlobalShortcutTarget(event.target)) {
    return;
  }

  const key = event.key.toLowerCase();
  if (handleEditingShortcutKeyDown(editor, event, key)) {
    return;
  }

  if (handleCanvasShortcutKeyDown(editor, event, key)) {
    return;
  }

  if (editor.currentTool.onKeyDown({ event, key })) {
    event.preventDefault();
  }
};

export const handleSpaceDown = (editor, event) => {
  if (event.code !== "Space" || isInputElement(event.target)) {
    return;
  }

  event.preventDefault();
  editor.getState().setSpacePressed(true);
};

export const handleSpaceUp = (editor, event) => {
  if (event.code !== "Space") {
    return;
  }

  editor.getState().setSpacePressed(false);
};
