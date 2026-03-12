import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  createTextNode,
  getSelectionSnapshot,
  getStateSnapshot,
  gotoEditor,
} from "./editor-helpers";

type CommandListener = (
  command: "export" | "open" | "save" | "save-as"
) => void;
interface OpenedDocumentPayload {
  contents: string;
  fileHandle: string;
  fileName: string;
}
type OpenDocumentListener = (openedDocument: OpenedDocumentPayload) => void;
type SavedPayload = Record<string, unknown>;
type TestElectronWindow = Window & {
  __TEST_ELECTRON__: {
    emitOpenDocument: (openedDocument: OpenedDocumentPayload) => void;
    getSavedPayloads: () => SavedPayload[];
  };
  electron: Window["electron"];
};

const TEST_DOCUMENT = readFileSync(
  new URL("./fixtures/documents/document-io-roundtrip.punch", import.meta.url),
  "utf8"
);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const commandListeners: CommandListener[] = [];
    const openDocumentListeners: OpenDocumentListener[] = [];
    const savedPayloads: SavedPayload[] = [];
    const testWindow = window as TestElectronWindow;

    const removeListener = <T>(listeners: T[], callback: T) => {
      const index = listeners.indexOf(callback);

      if (index >= 0) {
        listeners.splice(index, 1);
      }
    };

    testWindow.__TEST_ELECTRON__ = {
      emitOpenDocument(openedDocument) {
        for (const listener of openDocumentListeners) {
          listener(openedDocument);
        }
      },
      getSavedPayloads() {
        return [...savedPayloads];
      },
    };

    testWindow.electron = {
      documentCommands: {
        onCommand(callback) {
          commandListeners.push(callback);
          return () => removeListener(commandListeners, callback);
        },
        onOpenDocument(callback) {
          openDocumentListeners.push(callback);
          return () => removeListener(openDocumentListeners, callback);
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
        saveDocument(payload) {
          savedPayloads.push(payload as SavedPayload);

          return Promise.resolve({
            canceled: false,
            fileHandle: "/tmp/saved-from-test.punch",
            fileName: "saved-from-test.punch",
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

test("prompts before replacing dirty state from the desktop open-file event", async ({
  page,
}) => {
  await gotoEditor(page);
  await createTextNode(page, { text: "DIRTY", x: 240, y: 240 });

  await expect(
    page.getByRole("button", { name: "DIRTY" }).first()
  ).toBeVisible();

  await page.evaluate((contents) => {
    const testWindow = window as TestElectronWindow;

    testWindow.__TEST_ELECTRON__.emitOpenDocument({
      contents,
      fileHandle: "/tmp/opened-from-event.punch",
      fileName: "opened-from-event.punch",
    });
  }, TEST_DOCUMENT);

  await expect(page.getByText("Save changes before opening?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeFocused();
  expect((await getSelectionSnapshot(page)).selectedNodeIds).toHaveLength(1);
  await page.keyboard.press("Delete");
  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      return state.nodes.map((node) => node.text);
    })
    .toEqual(["DIRTY"]);
  expect(
    await page.evaluate(() => {
      const testWindow = window as TestElectronWindow;

      return testWindow.__TEST_ELECTRON__.getSavedPayloads();
    })
  ).toHaveLength(0);

  await page
    .getByText("Save your work first, discard your changes, or cancel.")
    .click();
  expect((await getSelectionSnapshot(page)).selectedNodeIds).toHaveLength(1);

  const canvasStageBox = await page.getByTestId("canvas-stage").boundingBox();

  if (!canvasStageBox) {
    throw new Error("Missing canvas stage bounds.");
  }

  await page.mouse.click(canvasStageBox.x + 40, canvasStageBox.y + 40);
  await expect(page.getByText("Save changes before opening?")).toBeVisible();
  expect((await getSelectionSnapshot(page)).selectedNodeIds).toHaveLength(1);

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Save changes before opening?")).toHaveCount(0);

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      return state.nodes.map((node) => node.text);
    })
    .toEqual(["DIRTY"]);

  await page.evaluate((contents) => {
    const testWindow = window as TestElectronWindow;

    testWindow.__TEST_ELECTRON__.emitOpenDocument({
      contents,
      fileHandle: "/tmp/opened-from-event.punch",
      fileName: "opened-from-event.punch",
    });
  }, TEST_DOCUMENT);

  await expect(page.getByText("Save changes before opening?")).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      return state.nodes.map((node) => node.text);
    })
    .toEqual(["TEST"]);

  expect(
    await page.evaluate(() => {
      const testWindow = window as TestElectronWindow;

      return testWindow.__TEST_ELECTRON__.getSavedPayloads();
    })
  ).toEqual([
    expect.objectContaining({
      defaultFileName: "untitled-design.punch",
    }),
  ]);
});
