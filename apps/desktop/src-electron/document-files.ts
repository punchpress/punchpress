import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";

const OPEN_DOCUMENT_CHANNEL = "document:open";
const SAVE_DOCUMENT_CHANNEL = "document:save";
const SAVE_SVG_CHANNEL = "document:save-svg";

const getDialogWindow = () => {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
};

const normalizeFilePath = (value: unknown) => {
  return typeof value === "string" && value.length > 0 ? value : null;
};

const resolveDefaultSavePath = (defaultFileName: string) => {
  return path.join(app.getPath("documents"), defaultFileName);
};

const showSaveDialogForPath = async (
  defaultFileName: string,
  filters: Array<{ extensions: string[]; name: string }>
) => {
  const result = await dialog.showSaveDialog(getDialogWindow(), {
    defaultPath: resolveDefaultSavePath(defaultFileName),
    filters,
  });

  return result.canceled ? null : normalizeFilePath(result.filePath);
};

export const registerDocumentFileHandlers = () => {
  ipcMain.handle(OPEN_DOCUMENT_CHANNEL, async () => {
    const result = await dialog.showOpenDialog(getDialogWindow(), {
      filters: [
        {
          extensions: ["punch"],
          name: "PunchPress documents",
        },
      ],
      properties: ["openFile"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];

    return {
      contents: await readFile(filePath, "utf8"),
      fileHandle: filePath,
      fileName: path.basename(filePath),
    };
  });

  ipcMain.handle(
    SAVE_DOCUMENT_CHANNEL,
    async (
      _event,
      payload: {
        contents: string;
        defaultFileName: string;
        fileHandle?: string | null;
      }
    ) => {
      const existingPath = normalizeFilePath(payload?.fileHandle);
      const targetPath =
        existingPath ||
        (await showSaveDialogForPath(payload.defaultFileName, [
          {
            extensions: ["punch"],
            name: "PunchPress documents",
          },
        ]));

      if (!targetPath) {
        return {
          canceled: true,
          fileHandle: existingPath,
          fileName: existingPath ? path.basename(existingPath) : null,
        };
      }

      await writeFile(targetPath, payload.contents, "utf8");

      return {
        canceled: false,
        fileHandle: targetPath,
        fileName: path.basename(targetPath),
      };
    }
  );

  ipcMain.handle(
    SAVE_SVG_CHANNEL,
    async (
      _event,
      payload: {
        contents: string;
        defaultFileName: string;
      }
    ) => {
      const targetPath = await showSaveDialogForPath(payload.defaultFileName, [
        {
          extensions: ["svg"],
          name: "SVG exports",
        },
      ]);

      if (!targetPath) {
        return {
          canceled: true,
          fileHandle: null,
          fileName: null,
        };
      }

      await writeFile(targetPath, payload.contents, "utf8");

      return {
        canceled: false,
        fileHandle: targetPath,
        fileName: path.basename(targetPath),
      };
    }
  );
};
