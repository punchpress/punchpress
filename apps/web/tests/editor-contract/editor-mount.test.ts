import { afterEach, describe, expect, mock, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const globalWithWindow = globalThis as typeof globalThis & {
  window?: {
    addEventListener: (...args: unknown[]) => void;
    removeEventListener: (...args: unknown[]) => void;
    electron?: {
      editorCommands?: {
        onCommand: (...args: unknown[]) => (() => void) | void;
      };
    };
  };
};

const originalWindow = globalWithWindow.window;

afterEach(() => {
  globalWithWindow.window = originalWindow;
});

describe("Editor.mount", () => {
  test("does not subscribe to the desktop editor command bridge", () => {
    const addEventListener = mock(() => undefined);
    const removeEventListener = mock(() => undefined);
    const onCommand = mock(() => {
      return () => undefined;
    });
    const editor = new Editor();

    editor.preloadFonts = () => undefined;
    editor.initializeLocalFonts = () => Promise.resolve();
    globalWithWindow.window = {
      addEventListener,
      electron: {
        editorCommands: {
          onCommand,
        },
      },
      removeEventListener,
    };

    editor.mount();
    editor.dispose();

    expect(onCommand).not.toHaveBeenCalled();
    expect(addEventListener).toHaveBeenCalled();
    expect(removeEventListener).toHaveBeenCalled();
  });
});
