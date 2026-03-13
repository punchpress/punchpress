import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  createTextNode,
  getStateSnapshot,
  gotoEditor,
  setSelectedFont,
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
    emitCommand: (command: "export" | "open" | "save" | "save-as") => void;
    emitOpenDocument: (openedDocument: OpenedDocumentPayload) => void;
    getSavedSvgPayloads: () => SavedPayload[];
  };
  electron: Window["electron"];
};

const TEST_FONT_PATHS = [
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "C:\\Windows\\Fonts\\arial.ttf",
];
const TEST_FONT_PATH = TEST_FONT_PATHS.find((candidate) =>
  existsSync(candidate)
);
const TEST_FONT_BYTES = TEST_FONT_PATH ? [...readFileSync(TEST_FONT_PATH)] : [];
const TEST_FONT_DESCRIPTOR = TEST_FONT_PATH?.toLowerCase().includes("dejavu")
  ? {
      family: "DejaVu Sans",
      fullName: "DejaVu Sans",
      id: "dejavusans",
      postscriptName: "DejaVuSans",
      style: "Book",
    }
  : {
      family: "Arial",
      fullName: "Arial",
      id: "arialmt",
      postscriptName: "ArialMT",
      style: "Regular",
    };

const MISSING_FONT_DESCRIPTOR = {
  family: "Missing Font",
  fullName: "Missing Font",
  postscriptName: "MissingFont-Regular",
  style: "Regular",
} as const;

const MISSING_FONT_DOCUMENT = JSON.stringify({
  nodes: [
    {
      fill: "#ffffff",
      font: MISSING_FONT_DESCRIPTOR,
      fontSize: 280,
      id: "missing-font-node",
      stroke: "#000000",
      strokeWidth: 10,
      text: "TEST",
      tracking: 8,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 960,
        y: 720,
      },
      type: "text",
      visible: true,
      warp: {
        bend: 0.4,
        kind: "arch",
      },
    },
  ],
  version: "1.1",
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ fontBytes, fontDescriptor }) => {
      const commandListeners: CommandListener[] = [];
      const openDocumentListeners: OpenDocumentListener[] = [];
      const savedSvgPayloads: SavedPayload[] = [];
      const testWindow = window as TestElectronWindow;

      const removeListener = <T>(listeners: T[], callback: T) => {
        const index = listeners.indexOf(callback);

        if (index >= 0) {
          listeners.splice(index, 1);
        }
      };

      testWindow.__TEST_ELECTRON__ = {
        emitCommand(command) {
          for (const listener of commandListeners) {
            listener(command);
          }
        },
        emitOpenDocument(openedDocument) {
          for (const listener of openDocumentListeners) {
            listener(openedDocument);
          }
        },
        getSavedSvgPayloads() {
          return [...savedSvgPayloads];
        },
      };

      testWindow.electron = {
        documentCommands: {
          markReady() {},
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
          saveDocument() {
            return Promise.resolve({
              canceled: true,
              fileHandle: null,
              fileName: null,
            });
          },
          saveSvg(payload) {
            savedSvgPayloads.push(payload as SavedPayload);
            return Promise.resolve({
              canceled: false,
              fileHandle: "/tmp/exported-from-test.svg",
              fileName: "exported-from-test.svg",
            });
          },
        },
        localFonts: {
          listFonts() {
            return Promise.resolve([fontDescriptor]);
          },
          readFont(fontId) {
            return Promise.resolve(
              fontId === fontDescriptor.id ? new Uint8Array(fontBytes) : null
            );
          },
        },
        versions: {
          chrome: "test",
          electron: "test",
          node: "test",
        },
      };
    },
    {
      fontBytes: TEST_FONT_BYTES,
      fontDescriptor: TEST_FONT_DESCRIPTOR,
    }
  );
});

test("notifies when an opened document falls back to the default font", async ({
  page,
}) => {
  await gotoEditor(page);

  await page.evaluate((contents) => {
    const testWindow = window as TestElectronWindow;

    testWindow.__TEST_ELECTRON__.emitOpenDocument({
      contents,
      fileHandle: "/tmp/missing-font-document.punch",
      fileName: "missing-font-document.punch",
    });
  }, MISSING_FONT_DOCUMENT);

  await expect(
    page.getByText(
      `Replaced missing font Missing Font with ${TEST_FONT_DESCRIPTOR.fullName}.`
    )
  ).toBeVisible();

  await expect
    .poll(async () => {
      const state = await getStateSnapshot(page);
      return state.nodes[0]?.font?.fullName;
    })
    .toBe(TEST_FONT_DESCRIPTOR.fullName);
});

test("shows an export error dialog when the current document uses a missing font", async ({
  page,
}) => {
  await gotoEditor(page);
  await createTextNode(page, { text: "EXPORT", x: 360, y: 280 });
  await setSelectedFont(page, MISSING_FONT_DESCRIPTOR);

  await page.evaluate(() => {
    const testWindow = window as TestElectronWindow;

    testWindow.__TEST_ELECTRON__.emitCommand("export");
  });

  await expect(
    page.getByText("Can't export while fonts are missing")
  ).toBeVisible();
  await expect(
    page
      .getByRole("dialog", { name: "Can't export while fonts are missing" })
      .getByText("Missing Font", { exact: true })
  ).toBeVisible();

  expect(
    await page.evaluate(() => {
      const testWindow = window as TestElectronWindow;

      return testWindow.__TEST_ELECTRON__.getSavedSvgPayloads();
    })
  ).toHaveLength(0);
});
