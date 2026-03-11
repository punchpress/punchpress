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
  },
  documentFiles: {
    openDocument: () => ipcRenderer.invoke("document:open"),
    saveDocument: (payload) => ipcRenderer.invoke("document:save", payload),
    saveSvg: (payload) => ipcRenderer.invoke("document:save-svg", payload),
  },
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
});
