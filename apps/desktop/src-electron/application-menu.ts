import path from "node:path";
import { Menu, type MenuItemConstructorOptions } from "electron";
import { getRecentDocuments } from "./recent-documents.js";

interface InstallApplicationMenuOptions {
  clearRecentDocumentsFromMenu: () => Promise<void>;
  openRecentDocumentFromMenu: (filePath: string) => Promise<void>;
  sendDocumentCommand: (
    command: "export" | "new" | "open" | "save" | "save-as"
  ) => void;
  sendEditorCommand: (command: "redo" | "undo") => void;
}

const buildOpenRecentSubmenu = async ({
  clearRecentDocumentsFromMenu,
  openRecentDocumentFromMenu,
}: Pick<
  InstallApplicationMenuOptions,
  "clearRecentDocumentsFromMenu" | "openRecentDocumentFromMenu"
>): Promise<MenuItemConstructorOptions[]> => {
  const recentDocuments = await getRecentDocuments();

  if (recentDocuments.length === 0) {
    return [
      {
        enabled: false,
        label: "No Recent Documents",
      },
    ];
  }

  const duplicateRecentDocumentNames = new Set(
    recentDocuments
      .map((recentDocument) => recentDocument.fileName)
      .filter((fileName, index, fileNames) => {
        return fileNames.indexOf(fileName) !== index;
      })
  );

  return [
    ...recentDocuments.map((recentDocument) => ({
      click: () => {
        openRecentDocumentFromMenu(recentDocument.filePath).catch((error) => {
          console.error(error);
        });
      },
      label: recentDocument.fileName,
      sublabel: duplicateRecentDocumentNames.has(recentDocument.fileName)
        ? path.dirname(recentDocument.filePath)
        : undefined,
    })),
    { type: "separator" },
    {
      click: () => {
        clearRecentDocumentsFromMenu().catch((error) => {
          console.error(error);
        });
      },
      label: "Clear Recent",
    },
  ];
};

export const installApplicationMenu = async ({
  clearRecentDocumentsFromMenu,
  openRecentDocumentFromMenu,
  sendDocumentCommand,
  sendEditorCommand,
}: InstallApplicationMenuOptions) => {
  const openRecentSubmenu = await buildOpenRecentSubmenu({
    clearRecentDocumentsFromMenu,
    openRecentDocumentFromMenu,
  });
  const template: MenuItemConstructorOptions[] = [
    {
      label: "PunchPress",
      submenu: [
        { role: "about" },
        {
          label: "Open Recent",
          submenu: openRecentSubmenu,
        },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "showAll" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        {
          accelerator: "CmdOrCtrl+N",
          click: () => sendDocumentCommand("new"),
          label: "New",
        },
        {
          accelerator: "CmdOrCtrl+O",
          click: () => sendDocumentCommand("open"),
          label: "Open...",
        },
        {
          accelerator: "CmdOrCtrl+S",
          click: () => sendDocumentCommand("save"),
          label: "Save",
        },
        {
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => sendDocumentCommand("save-as"),
          label: "Save As...",
        },
        {
          accelerator: "CmdOrCtrl+E",
          click: () => sendDocumentCommand("export"),
          label: "Export SVG...",
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        {
          accelerator: "CmdOrCtrl+Z",
          click: () => sendEditorCommand("undo"),
          label: "Undo",
        },
        {
          accelerator: "CmdOrCtrl+Shift+Z",
          click: () => sendEditorCommand("redo"),
          label: "Redo",
        },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "bringAllToFront" },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};
