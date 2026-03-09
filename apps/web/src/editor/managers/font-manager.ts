import opentype from "opentype.js";

const editableFamilyByUrl = new Map();
const loadedEditableFamilies = new Set();

export const DEFAULT_EDITABLE_FONT_FAMILY = "DM Sans, sans-serif";

const hashString = (value) => {
  let hash = 17;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) % 2_147_483_647;
  }

  return Math.abs(hash).toString(36);
};

const getEditableFamilyName = (url) => {
  if (editableFamilyByUrl.has(url)) {
    return editableFamilyByUrl.get(url);
  }

  const family = `warp-edit-${hashString(url)}`;
  editableFamilyByUrl.set(url, family);
  return family;
};

const ensureEditableFontFamilyLoaded = async (url) => {
  if (typeof FontFace === "undefined" || typeof document === "undefined") {
    return;
  }

  const family = getEditableFamilyName(url);
  if (loadedEditableFamilies.has(family)) {
    return;
  }

  const fontFace = new FontFace(family, `url("${url}")`);
  await fontFace.load();
  document.fonts.add(fontFace);
  loadedEditableFamilies.add(family);
};

const loadFont = (url) => {
  return new Promise((resolve, reject) => {
    opentype.load(url, (error, font) => {
      if (error || !font) {
        reject(error || new Error("Unable to load font."));
        return;
      }

      resolve(font);
    });
  });
};

export class FontManager {
  constructor({ onChange }) {
    this.cache = new Map();
    this.onChange = onChange;
  }

  preload(fonts, nodes) {
    const urls = new Set();

    for (const font of fonts) {
      urls.add(font.url);
    }

    for (const node of nodes) {
      urls.add(node.fontUrl);
    }

    for (const url of urls) {
      this.ensureLoaded(url);
    }
  }

  ensureLoaded(url) {
    const cacheEntry = this.cache.get(url);
    if (cacheEntry?.status === "ready" || cacheEntry?.status === "loading") {
      return;
    }

    this.cache.set(url, { status: "loading" });
    this.loadIntoCache(url).catch(() => undefined);
  }

  getLoadedFont(url) {
    const cacheEntry = this.cache.get(url);
    return cacheEntry?.status === "ready" ? cacheEntry.font : null;
  }

  getEditableFontFamily(url) {
    const cacheEntry = this.cache.get(url);
    if (cacheEntry?.status === "ready" && cacheEntry.editableFamily) {
      return cacheEntry.editableFamily;
    }

    return DEFAULT_EDITABLE_FONT_FAMILY;
  }

  async loadIntoCache(url) {
    try {
      const font = await loadFont(url);
      await ensureEditableFontFamilyLoaded(url);
      this.cache.set(url, {
        status: "ready",
        font,
        editableFamily: getEditableFamilyName(url),
      });
      this.onChange();
    } catch {
      this.cache.set(url, { status: "error" });
      this.onChange();
    }
  }
}
