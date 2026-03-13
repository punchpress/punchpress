import {
  areLocalFontsEqual,
  createLocalFontDescriptor,
  DEFAULT_LOCAL_FONT,
  type LocalFontDescriptor,
  type LocalFontOption,
} from "./local-fonts";

const LAST_USED_FONT_STORAGE_KEY = "punchpress.last-used-font";
const DEFAULT_SANS_CANDIDATES = [
  "sf pro",
  "helvetica",
  "avenir",
  "arial",
  "segoe ui",
  "roboto",
  "inter",
  "noto sans",
  "liberation sans",
  "dejavu sans",
] as const;

const normalizeFontName = (value = "") => {
  return value.trim().toLowerCase();
};

const matchesCandidate = (
  font: LocalFontDescriptor | LocalFontOption,
  candidate: string
) => {
  const normalizedCandidate = normalizeFontName(candidate);
  const names = [font.family, font.fullName].map((value) =>
    normalizeFontName(value)
  );

  return names.some((value) => {
    return (
      value === normalizedCandidate ||
      value.startsWith(`${normalizedCandidate} `)
    );
  });
};

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

export const resolveDefaultFont = (
  fonts: readonly (LocalFontDescriptor | LocalFontOption)[],
  lastUsedFont: LocalFontDescriptor | null
) => {
  if (lastUsedFont) {
    const matchingLastUsedFont = fonts.find((font) => {
      return areLocalFontsEqual(font, lastUsedFont);
    });

    if (matchingLastUsedFont) {
      return createLocalFontDescriptor(matchingLastUsedFont);
    }
  }

  for (const candidate of DEFAULT_SANS_CANDIDATES) {
    const matchingFont = fonts.find((font) => matchesCandidate(font, candidate));

    if (matchingFont) {
      return createLocalFontDescriptor(matchingFont);
    }
  }

  return createLocalFontDescriptor(fonts[0] || DEFAULT_LOCAL_FONT);
};
