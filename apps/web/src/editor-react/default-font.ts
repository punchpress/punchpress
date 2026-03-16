import {
  createLocalFontDescriptor,
  type LocalFontDescriptor,
  type LocalFontOption,
} from "@punchpress/punch-schema";

const LAST_USED_FONT_STORAGE_KEY = "punchpress.last-used-font";

export const getStoredLastUsedFont = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(LAST_USED_FONT_STORAGE_KEY);

    if (!storedValue) {
      return null;
    }

    return createLocalFontDescriptor(JSON.parse(storedValue));
  } catch {
    return null;
  }
};

export const rememberLastUsedFont = (
  font: LocalFontDescriptor | LocalFontOption
) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    LAST_USED_FONT_STORAGE_KEY,
    JSON.stringify(createLocalFontDescriptor(font))
  );
};
