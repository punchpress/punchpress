import opentype from "opentype.js";
import { readLocalFontBytes } from "../../platform/local-fonts";
import {
  areLocalFontsEqual,
  createLocalFontDescriptor,
  DEFAULT_LOCAL_FONT,
  getLocalFontId,
} from "../local-fonts";

const editableFamilyById = new Map<string, string>();
const loadedEditableFamilies = new Set<string>();

export const DEFAULT_EDITABLE_FONT_FAMILY = "system-ui, sans-serif";
export const IDLE_FONT_STATUS = "idle";

const hashString = (value: string) => {
  let hash = 17;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) % 2_147_483_647;
  }

  return Math.abs(hash).toString(36);
};

const getEditableFamilyName = (font) => {
  const fontId = getLocalFontId(font);

  if (editableFamilyById.has(fontId)) {
    return editableFamilyById.get(fontId);
  }

  const family = `warp-edit-${hashString(fontId)}`;
  editableFamilyById.set(fontId, family);
  return family;
};

const loadFont = async (font) => {
  const bytes = await readLocalFontBytes(font);

  if (!bytes) {
    throw new Error(`Unable to read font bytes for ${font.fullName}.`);
  }

  return {
    bytes,
    font: opentype.parse(bytes),
  };
};

const ensureEditableFontFamilyLoaded = async (font, bytes) => {
  if (typeof FontFace === "undefined" || typeof document === "undefined") {
    return;
  }

  const family = getEditableFamilyName(font);
  if (loadedEditableFamilies.has(family)) {
    return;
  }

  const fontFace = new FontFace(family, bytes);
  await fontFace.load();
  document.fonts.add(fontFace);
  loadedEditableFamilies.add(family);
};

export class FontManager {
  constructor({ onChange }) {
    this.cache = new Map();
    this.onChange = onChange;
  }

  preload(nodes) {
    for (const node of nodes) {
      this.ensureLoaded(node.font);
    }
  }

  preloadFont(font) {
    this.ensureLoaded(font);
  }

  getCacheEntry(font) {
    const descriptor = createLocalFontDescriptor(font || DEFAULT_LOCAL_FONT);
    return this.cache.get(getLocalFontId(descriptor)) || null;
  }

  getLoadState(font) {
    return this.getCacheEntry(font)?.status || IDLE_FONT_STATUS;
  }

  ensureLoaded(font) {
    const descriptor = createLocalFontDescriptor(font || DEFAULT_LOCAL_FONT);
    const fontId = getLocalFontId(descriptor);
    const cacheEntry = this.cache.get(fontId);

    if (cacheEntry?.status === "ready" || cacheEntry?.status === "loading") {
      return;
    }

    this.cache.set(fontId, {
      descriptor,
      status: "loading",
    });
    this.loadIntoCache(descriptor).catch(() => undefined);
  }

  getLoadedFont(font) {
    const cacheEntry = this.getCacheEntry(font);
    return cacheEntry?.status === "ready" ? cacheEntry.font : null;
  }

  getEditableFontFamily(font) {
    const descriptor = createLocalFontDescriptor(font || DEFAULT_LOCAL_FONT);
    const cacheEntry = this.getCacheEntry(descriptor);

    if (cacheEntry?.status === "ready" && cacheEntry.editableFamily) {
      return cacheEntry.editableFamily;
    }

    return descriptor.family
      ? `"${descriptor.family}", ${DEFAULT_EDITABLE_FONT_FAMILY}`
      : DEFAULT_EDITABLE_FONT_FAMILY;
  }

  async loadIntoCache(font) {
    const descriptor = createLocalFontDescriptor(font);
    const fontId = getLocalFontId(descriptor);

    try {
      const { bytes, font: loadedFont } = await loadFont(descriptor);
      await ensureEditableFontFamilyLoaded(descriptor, bytes);
      this.cache.set(fontId, {
        descriptor,
        editableFamily: getEditableFamilyName(descriptor),
        font: loadedFont,
        status: "ready",
      });
      this.onChange();
    } catch {
      this.cache.set(fontId, {
        descriptor,
        status: "error",
      });
      this.onChange();
    }
  }

  async loadFontForExport(font) {
    const descriptor = createLocalFontDescriptor(font || DEFAULT_LOCAL_FONT);
    const cached = this.getCacheEntry(descriptor);

    if (
      cached?.status === "ready" &&
      areLocalFontsEqual(cached.descriptor, descriptor)
    ) {
      return cached.font;
    }

    const { bytes, font: loadedFont } = await loadFont(descriptor);
    await ensureEditableFontFamilyLoaded(descriptor, bytes).catch(
      () => undefined
    );

    this.cache.set(getLocalFontId(descriptor), {
      descriptor,
      editableFamily: getEditableFamilyName(descriptor),
      font: loadedFont,
      status: "ready",
    });

    return loadedFont;
  }
}
