import { expect, test } from "@playwright/test";
import {
  createTextNode,
  expectHandleAlignedToNodeCorner,
  getNodeSnapshot,
  getSelectionSnapshot,
  getStateSnapshot,
  gotoEditor,
  setSelectedText,
  waitForSelectionHandles,
} from "./editor-helpers";

type EditorCommand = "redo" | "undo";
type EditorCommandListener = (command: EditorCommand) => void;
type TestElectronWindow = Window & {
  __TEST_ELECTRON__: {
    emitEditorCommand: (command: EditorCommand) => void;
  };
  electron: Window["electron"];
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const editorCommandListeners: EditorCommandListener[] = [];
    const testWindow = window as TestElectronWindow;

    const removeListener = <T>(listeners: T[], callback: T) => {
      const index = listeners.indexOf(callback);

      if (index >= 0) {
        listeners.splice(index, 1);
      }
    };

    testWindow.__TEST_ELECTRON__ = {
      emitEditorCommand(command) {
        for (const listener of editorCommandListeners) {
          listener(command);
        }
      },
    };

    testWindow.electron = {
      documentCommands: {
        markReady() {
          // Test stub.
        },
        onCommand() {
          return () => undefined;
        },
        onBeforeClose() {
          return () => undefined;
        },
        onOpenDocument() {
          return () => undefined;
        },
        onRecentDocumentsChanged() {
          return () => undefined;
        },
        respondBeforeClose() {
          // Test stub.
        },
      },
      editorCommands: {
        onCommand(callback) {
          editorCommandListeners.push(callback);
          return () => removeListener(editorCommandListeners, callback);
        },
      },
      documentFiles: {
        getRecentDocuments() {
          return Promise.resolve([]);
        },
        openDocument() {
          return Promise.resolve(null);
        },
        openRecentDocument() {
          return Promise.resolve(null);
        },
        saveDocument() {
          return Promise.resolve({
            canceled: true,
            fileHandle: null,
            fileName: null,
          });
        },
        saveSvg() {
          return Promise.resolve({
            canceled: true,
            fileHandle: null,
            fileName: null,
          });
        },
      },
      versions: {
        chrome: "test",
        electron: "test",
        node: "test",
      },
    };
  });
});

test("applies undo and redo from the desktop editor command channel", async ({
  page,
}) => {
  await gotoEditor(page);
  await createTextNode(page, { text: "UNDO REDO", x: 240, y: 240 });

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      return state.nodes.map((node) => node.text);
    })
    .toEqual(["UNDO REDO"]);

  await page.evaluate(() => {
    const testWindow = window as TestElectronWindow;

    testWindow.__TEST_ELECTRON__.emitEditorCommand("undo");
  });

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      return state.nodes.length;
    })
    .toBe(0);

  await page.evaluate(() => {
    const testWindow = window as TestElectronWindow;

    testWindow.__TEST_ELECTRON__.emitEditorCommand("redo");
  });

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      return state.nodes.map((node) => node.text);
    })
    .toEqual(["UNDO REDO"]);
});

test("redo refreshes selection bounds after a text geometry change", async ({
  page,
}) => {
  await gotoEditor(page);
  const nodeId = await createTextNode(page, {
    text: "HEYHEYHEYHEY",
    x: 240,
    y: 240,
  });

  await expect
    .poll(async () => {
      const snapshot = await getNodeSnapshot(page, nodeId);
      return snapshot?.text;
    })
    .toBe("HEYHEYHEYHEY");

  await setSelectedText(page, "HEY");

  await expect
    .poll(async () => {
      const snapshot = await getNodeSnapshot(page, nodeId);
      return snapshot?.text;
    })
    .toBe("HEY");

  await page.evaluate(() => {
    const testWindow = window as TestElectronWindow;

    testWindow.__TEST_ELECTRON__.emitEditorCommand("undo");
  });

  await expect
    .poll(async () => {
      const snapshot = await getNodeSnapshot(page, nodeId);
      return snapshot?.text;
    })
    .toBe("HEYHEYHEYHEY");

  await page.evaluate(() => {
    const testWindow = window as TestElectronWindow;

    testWindow.__TEST_ELECTRON__.emitEditorCommand("redo");
  });

  await expect
    .poll(async () => {
      const snapshot = await getNodeSnapshot(page, nodeId);
      return snapshot?.text;
    })
    .toBe("HEY");

  await expect
    .poll(async () => {
      const snapshot = await getNodeSnapshot(page, nodeId);
      const selection = await getSelectionSnapshot(page);

      if (
        !(snapshot?.elementRect && selection.handles.nw && selection.handles.se)
      ) {
        return Number.POSITIVE_INFINITY;
      }

      const nwCenter = {
        x: selection.handles.nw.x + selection.handles.nw.width / 2,
        y: selection.handles.nw.y + selection.handles.nw.height / 2,
      };
      const seCenter = {
        x: selection.handles.se.x + selection.handles.se.width / 2,
        y: selection.handles.se.y + selection.handles.se.height / 2,
      };

      return Math.max(
        Math.abs(nwCenter.x - snapshot.elementRect.left),
        Math.abs(nwCenter.y - snapshot.elementRect.top),
        Math.abs(seCenter.x - snapshot.elementRect.right),
        Math.abs(seCenter.y - snapshot.elementRect.bottom)
      );
    })
    .toBeLessThanOrEqual(14);

  const selection = await waitForSelectionHandles(page);
  const snapshot = await getNodeSnapshot(page, nodeId);

  expectHandleAlignedToNodeCorner(
    selection.handles.nw,
    snapshot.elementRect,
    "nw"
  );
  expectHandleAlignedToNodeCorner(
    selection.handles.se,
    snapshot.elementRect,
    "se"
  );
});
