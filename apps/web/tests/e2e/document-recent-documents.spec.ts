import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { gotoEditor } from "./editor-helpers";

interface RecentDocumentPayload {
  fileName: string;
  filePath: string;
  lastOpenedAt: string;
}

type RecentDocumentsChangedListener = () => void;

type TestElectronWindow = Window & {
  __TEST_ELECTRON__: {
    emitRecentDocumentsChanged: () => void;
    setRecentDocuments: (recentDocuments: RecentDocumentPayload[]) => void;
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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ fontBytes, fontDescriptor }) => {
      const recentDocumentsChangedListeners: RecentDocumentsChangedListener[] =
        [];
      let recentDocuments: RecentDocumentPayload[] = [
        {
          fileName: "alpha.punch",
          filePath: "/tmp/alpha.punch",
          lastOpenedAt: "2026-03-13T12:00:00.000Z",
        },
      ];
      const testWindow = window as TestElectronWindow;

      const removeListener = <T>(listeners: T[], callback: T) => {
        const index = listeners.indexOf(callback);

        if (index >= 0) {
          listeners.splice(index, 1);
        }
      };

      testWindow.__TEST_ELECTRON__ = {
        emitRecentDocumentsChanged() {
          for (const listener of recentDocumentsChangedListeners) {
            listener();
          }
        },
        setRecentDocuments(nextRecentDocuments) {
          recentDocuments = [...nextRecentDocuments];
        },
      };

      testWindow.electron = {
        documentCommands: {
          markReady() {},
          onCommand() {
            return () => undefined;
          },
          onBeforeClose() {
            return () => undefined;
          },
          onOpenDocument() {
            return () => undefined;
          },
          onRecentDocumentsChanged(callback) {
            recentDocumentsChangedListeners.push(callback);
            return () =>
              removeListener(recentDocumentsChangedListeners, callback);
          },
          respondBeforeClose() {},
        },
        documentFiles: {
          clearRecentDocuments() {
            recentDocuments = [];
            return Promise.resolve();
          },
          getRecentDocuments() {
            return Promise.resolve(recentDocuments);
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

test("refreshes the in-app recent documents menu after a native desktop update", async ({
  page,
}) => {
  await gotoEditor(page);

  await page.getByLabel("Open main menu").click();
  await page.getByRole("menuitem", { name: "Open Recent" }).hover();
  await expect(
    page.getByRole("menuitem", { name: "alpha.punch" })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  await page.evaluate(() => {
    const testWindow = window as TestElectronWindow;

    testWindow.__TEST_ELECTRON__.setRecentDocuments([
      {
        fileName: "beta.punch",
        filePath: "/tmp/beta.punch",
        lastOpenedAt: "2026-03-13T12:05:00.000Z",
      },
    ]);
    testWindow.__TEST_ELECTRON__.emitRecentDocumentsChanged();
  });

  await page.getByLabel("Open main menu").click();
  await page.getByRole("menuitem", { name: "Open Recent" }).hover();
  await expect(
    page.getByRole("menuitem", { name: "beta.punch" })
  ).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "alpha.punch" })).toHaveCount(
    0
  );
});
