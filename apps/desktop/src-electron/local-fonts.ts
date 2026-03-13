import { readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ipcMain } from "electron";
import opentype from "opentype.js";

const LIST_LOCAL_FONTS_CHANNEL = "fonts:list";
const READ_LOCAL_FONT_CHANNEL = "fonts:read";
const FONT_EXTENSIONS = new Set([".otf", ".ttf"]);
const FONT_DIRECTORIES = [
  "/System/Library/Fonts",
  "/Library/Fonts",
  path.join(os.homedir(), "Library/Fonts"),
];

interface IndexedFont {
  family: string;
  filePath: string;
  fullName: string;
  id: string;
  postscriptName: string;
  style: string;
}

let fontIndexPromise: Promise<Map<string, IndexedFont>> | null = null;

const createFontId = (value: {
  postscriptName: string;
}) => {
  return value.postscriptName.trim().toLowerCase();
};

const toArrayBuffer = (value: Buffer) => {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
};

const getNameRecordValue = (
  nameRecord: Record<string, string> | undefined,
  fallback = ""
) => {
  if (!nameRecord) {
    return fallback;
  }

  return (
    nameRecord.en ||
    nameRecord["en-US"] ||
    Object.values(nameRecord).find((value) => typeof value === "string") ||
    fallback
  );
};

const readFontMetadata = async (filePath: string) => {
  try {
    const bytes = await readFile(filePath);
    const font = opentype.parse(toArrayBuffer(bytes));
    const family = getNameRecordValue(font.names.fontFamily).trim();
    const fullName = getNameRecordValue(font.names.fullName, family).trim();
    const postscriptName = getNameRecordValue(
      font.names.postScriptName,
      fullName
    ).trim();
    const style = getNameRecordValue(font.names.fontSubfamily, "Regular").trim();

    if (!(family && fullName && postscriptName && style)) {
      return null;
    }

    return {
      family,
      filePath,
      fullName,
      id: createFontId({
        postscriptName,
      }),
      postscriptName,
      style,
    } satisfies IndexedFont;
  } catch {
    return null;
  }
};

const collectFontFiles = async (directoryPath: string): Promise<string[]> => {
  try {
    const entries = await readdir(directoryPath, {
      recursive: true,
      withFileTypes: true,
    });

    return entries
      .filter((entry) => {
        return entry.isFile() && FONT_EXTENSIONS.has(path.extname(entry.name).toLowerCase());
      })
      .map((entry) => path.join(entry.parentPath, entry.name));
  } catch {
    return [];
  }
};

const buildFontIndex = async () => {
  const filePaths = (
    await Promise.all(FONT_DIRECTORIES.map((directoryPath) => collectFontFiles(directoryPath)))
  ).flat();
  const indexedFonts = new Map<string, IndexedFont>();

  for (const filePath of filePaths) {
    const font = await readFontMetadata(filePath);
    if (!font || indexedFonts.has(font.id)) {
      continue;
    }

    indexedFonts.set(font.id, font);
  }

  return indexedFonts;
};

const getFontIndex = () => {
  if (!fontIndexPromise) {
    fontIndexPromise = buildFontIndex();
  }

  return fontIndexPromise;
};

export const registerLocalFontHandlers = () => {
  ipcMain.handle(LIST_LOCAL_FONTS_CHANNEL, async () => {
    const fontIndex = await getFontIndex();

    return [...fontIndex.values()]
      .map(({ family, fullName, id, postscriptName, style }) => ({
        family,
        fullName,
        id,
        postscriptName,
        style,
      }))
      .sort((left, right) => left.fullName.localeCompare(right.fullName));
  });

  ipcMain.handle(READ_LOCAL_FONT_CHANNEL, async (_event, fontId: unknown) => {
    if (typeof fontId !== "string" || fontId.trim().length === 0) {
      return null;
    }

    const fontIndex = await getFontIndex();
    const indexedFont = fontIndex.get(fontId.trim().toLowerCase());

    if (!indexedFont) {
      return null;
    }

    const bytes = await readFile(indexedFont.filePath);
    return new Uint8Array(bytes);
  });
};
