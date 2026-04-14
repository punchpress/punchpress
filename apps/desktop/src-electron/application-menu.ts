import path from "node:path";
import { Menu, type MenuItemConstructorOptions } from "electron";
import type {
  DesktopAppMenuState,
  DesktopEditorCommand,
  DesktopMenuChoiceState,
  DesktopVectorFillRule,
  DesktopVectorStrokeLineCap,
  DesktopVectorStrokeLineJoin,
} from "./app-menu-types.js";
import { getRecentDocuments } from "./recent-documents.js";

interface InstallApplicationMenuOptions {
  appMenuState: DesktopAppMenuState | null;
  clearRecentDocumentsFromMenu: () => Promise<void>;
  openRecentDocumentFromMenu: (filePath: string) => Promise<void>;
  sendDocumentCommand: (
    command: "export" | "new" | "open" | "save" | "save-as"
  ) => void;
  sendEditorCommand: (command: DesktopEditorCommand) => void;
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
  appMenuState,
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
          click: () =>
            sendEditorCommand({
              action: "undo",
              type: "history",
            }),
          label: "Undo",
        },
        {
          accelerator: "CmdOrCtrl+Shift+Z",
          click: () =>
            sendEditorCommand({
              action: "redo",
              type: "history",
            }),
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
      label: "Object",
      submenu: buildObjectSubmenu(appMenuState, sendEditorCommand),
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

const buildObjectSubmenu = (
  appMenuState: DesktopAppMenuState | null,
  sendEditorCommand: (command: DesktopEditorCommand) => void
): MenuItemConstructorOptions[] => {
  const objectMenuState = appMenuState ?? {
    canDelete: false,
    canEditPath: false,
    selectedNodeType: null,
    selectionKind: "none" as const,
    vectorStyle: null,
  };

  const fillRuleSubmenu = buildChoiceSubmenu(
    objectMenuState.vectorStyle?.fillRule,
    [
      {
        command: {
          propertyId: "fillRule",
          type: "selection-property",
          value: "nonzero",
        },
        label: "Use Non-Zero Winding Fill Rule",
        value: "nonzero",
      },
      {
        command: {
          propertyId: "fillRule",
          type: "selection-property",
          value: "evenodd",
        },
        label: "Use Even-Odd Fill Rule",
        value: "evenodd",
      },
    ],
    sendEditorCommand
  );
  const strokeCapSubmenu = buildChoiceSubmenu(
    objectMenuState.vectorStyle?.strokeLineCap,
    [
      {
        command: {
          propertyId: "strokeLineCap",
          type: "selection-property",
          value: "butt",
        },
        label: "Butt Cap",
        value: "butt",
      },
      {
        command: {
          propertyId: "strokeLineCap",
          type: "selection-property",
          value: "round",
        },
        label: "Round Cap",
        value: "round",
      },
      {
        command: {
          propertyId: "strokeLineCap",
          type: "selection-property",
          value: "square",
        },
        label: "Projecting Cap",
        value: "square",
      },
    ],
    sendEditorCommand
  );
  const strokeJoinSubmenu = buildChoiceSubmenu(
    objectMenuState.vectorStyle?.strokeLineJoin,
    [
      {
        command: {
          propertyId: "strokeLineJoin",
          type: "selection-property",
          value: "miter",
        },
        label: "Miter Join",
        value: "miter",
      },
      {
        command: {
          propertyId: "strokeLineJoin",
          type: "selection-property",
          value: "round",
        },
        label: "Round Join",
        value: "round",
      },
      {
        command: {
          propertyId: "strokeLineJoin",
          type: "selection-property",
          value: "bevel",
        },
        label: "Bevel Join",
        value: "bevel",
      },
    ],
    sendEditorCommand
  );

  return [
    {
      click: () =>
        sendEditorCommand({
          action: "toggle-path-editing",
          type: "selection",
        }),
      enabled: objectMenuState.canEditPath,
      label: "Edit Path",
    },
    { type: "separator" },
    {
      enabled: isSubmenuEnabled(fillRuleSubmenu),
      label: "Fill Rule",
      submenu: fillRuleSubmenu,
    },
    {
      enabled: isSubmenuEnabled(strokeCapSubmenu),
      label: "Stroke Cap",
      submenu: strokeCapSubmenu,
    },
    {
      enabled: isSubmenuEnabled(strokeJoinSubmenu),
      label: "Stroke Join",
      submenu: strokeJoinSubmenu,
    },
    { type: "separator" },
    {
      click: () =>
        sendEditorCommand({
          action: "delete-selected",
          type: "selection",
        }),
      enabled: objectMenuState.canDelete,
      label: "Delete",
    },
  ];
};

const buildChoiceSubmenu = <
  Value extends
    | DesktopVectorFillRule
    | DesktopVectorStrokeLineCap
    | DesktopVectorStrokeLineJoin,
>(
  state: DesktopMenuChoiceState<Value> | null | undefined,
  options: {
    command: DesktopEditorCommand;
    label: string;
    value: Value;
  }[],
  sendEditorCommand: (command: DesktopEditorCommand) => void
): MenuItemConstructorOptions[] => {
  if (!state) {
    return [
      {
        enabled: false,
        label: "Unavailable",
      },
    ];
  }

  return options.map((option) => ({
    checked: !state.isMixed && state.value === option.value,
    click: () => sendEditorCommand(option.command),
    enabled: state.enabled,
    label: option.label,
    type: "radio",
  }));
};

const isSubmenuEnabled = (submenu: MenuItemConstructorOptions[]) => {
  return submenu.some((item) => item.enabled !== false);
};
