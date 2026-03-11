import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  documentCommands: {
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
  },
  documentFiles: {
    openDocument: () => ipcRenderer.invoke("document:open"),
    openRecentDocument: (filePath) =>
      ipcRenderer.invoke("document:open-recent", filePath),
    saveDocument: (payload) => ipcRenderer.invoke("document:save", payload),
    saveSvg: (payload) => ipcRenderer.invoke("document:save-svg", payload),
    getRecentDocuments: () => ipcRenderer.invoke("document:get-recent-documents"),
  },
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
});
