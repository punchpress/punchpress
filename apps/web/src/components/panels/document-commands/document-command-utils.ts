import type { LocalFontDescriptor } from "@punchpress/punch-schema";

export type DocumentCommand = "export" | "new" | "open" | "save" | "save-as";

export const getDocumentCommandFromKeyEvent = (event: KeyboardEvent) => {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) {
    return null;
  }

  const key = event.key.toLowerCase();

  if (key === "o") {
    return "open";
  }

  if (key === "n") {
    return "new";
  }

  if (key === "e") {
    return "export";
  }

  if (key === "s" && event.shiftKey) {
    return "save-as";
  }

  if (key === "s") {
    return "save";
  }

  return null;
};

export const getDocumentCommandErrorTitle = (command: DocumentCommand) => {
  if (command === "open") {
    return "Couldn't open file";
  }

  if (command === "new") {
    return "Couldn't create document";
  }

  if (command === "save" || command === "save-as") {
    return "Couldn't save file";
  }

  if (command === "export") {
    return "Couldn't export SVG";
  }

  return "File action failed";
};

export const formatFontList = (fonts: LocalFontDescriptor[]) => {
  if (fonts.length === 1) {
    return fonts[0].fullName;
  }

  if (fonts.length === 2) {
    return `${fonts[0].fullName} and ${fonts[1].fullName}`;
  }

  return `${fonts[0].fullName}, ${fonts[1].fullName}, and ${fonts.length - 2} more`;
};
