import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  documentCommands: {
    markReady: () => {
      ipcRenderer.send("document:renderer-ready");
    },
    onCommand: (callback) => {
      const listener = (_event, command) => callback(command);

      ipcRenderer.on("document:command", listener);

      return () => {
        ipcRenderer.removeListener("document:command", listener);
      };
    },
    onOpenDocument: (callback) => {
      const listener = (_event, openedDocument) => callback(openedDocument);

      ipcRenderer.on("document:open-file", listener);

      return () => {
        ipcRenderer.removeListener("document:open-file", listener);
      };
    },
    onRecentDocumentsChanged: (callback) => {
      const listener = () => callback();

      ipcRenderer.on("document:recent-documents-changed", listener);

      return () => {
        ipcRenderer.removeListener(
          "document:recent-documents-changed",
          listener
        );
      };
    },
    onBeforeClose: (callback) => {
      const listener = (_event, requestId) => callback(requestId);

      ipcRenderer.on("document:before-close", listener);

      return () => {
        ipcRenderer.removeListener("document:before-close", listener);
      };
    },
    respondBeforeClose: (requestId, shouldClose) => {
      ipcRenderer.send("document:close-response", requestId, shouldClose);
    },
  },
  editorCommands: {
    onCommand: (callback) => {
      const listener = (_event, command) => callback(command);

      ipcRenderer.on("editor:command", listener);

      return () => {
        ipcRenderer.removeListener("editor:command", listener);
      };
    },
  },
  documentFiles: {
    openDocument: () => ipcRenderer.invoke("document:open"),
    openRecentDocument: (filePath) =>
      ipcRenderer.invoke("document:open-recent", filePath),
    saveDocument: (payload) => ipcRenderer.invoke("document:save", payload),
    saveSvg: (payload) => ipcRenderer.invoke("document:save-svg", payload),
    getRecentDocuments: () =>
      ipcRenderer.invoke("document:get-recent-documents"),
    clearRecentDocuments: () =>
      ipcRenderer.invoke("document:clear-recent-documents"),
  },
  localFonts: {
    listFonts: () => ipcRenderer.invoke("fonts:list"),
    readFont: (fontId) => ipcRenderer.invoke("fonts:read", fontId),
  },
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
});
