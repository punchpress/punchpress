import opentype from "opentype.js";

const editableFamilyByUrl = new Map();
const loadedEditableFamilies = new Set();

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

export const ensureFontLoaded = async (url, fontCacheRef, onFontLoaded) => {
  const cacheEntry = fontCacheRef.current.get(url);
  if (cacheEntry?.status === "ready" || cacheEntry?.status === "loading") {
    return;
  }

  fontCacheRef.current.set(url, { status: "loading" });

  try {
    const font = await loadFont(url);
    await ensureEditableFontFamilyLoaded(url);
    fontCacheRef.current.set(url, {
      status: "ready",
      font,
      editableFamily: getEditableFamilyName(url),
    });
    onFontLoaded();
  } catch {
    fontCacheRef.current.set(url, { status: "error" });
    onFontLoaded();
  }
};

export const getLoadedFont = (url, fontCacheRef, revision) => {
  if (revision < 0) {
    return null;
  }

  const cacheEntry = fontCacheRef.current.get(url);
  return cacheEntry?.status === "ready" ? cacheEntry.font : null;
};

export const getEditableFontFamily = (url, fontCacheRef) => {
  const cacheEntry = fontCacheRef.current.get(url);
  if (cacheEntry?.status === "ready" && cacheEntry.editableFamily) {
    return cacheEntry.editableFamily;
  }
  return "DM Sans, sans-serif";
};
