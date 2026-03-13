export interface LocalFontDescriptor {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
}

export interface LocalFontOption extends LocalFontDescriptor {
  id: string;
}

export type LocalFontCatalogState =
  | "action-required"
  | "error"
  | "loading"
  | "permission-denied"
  | "ready"
  | "unsupported";

export interface LocalFontCatalogResult {
  error: string;
  fonts: LocalFontOption[];
  state: LocalFontCatalogState;
}

export const DEFAULT_LOCAL_FONT: LocalFontDescriptor = {
  family: "System UI",
  fullName: "System UI",
  postscriptName: "system-ui",
  style: "Regular",
};

const normalizePart = (value: string) => {
  return value.trim().replace(/\s+/g, " ");
};

export const getLocalFontId = (font: Partial<LocalFontDescriptor>) => {
  return (font.postscriptName || "").trim().toLowerCase();
};

export const createLocalFontOption = (
  font: Partial<LocalFontDescriptor> | null | undefined
): LocalFontOption => {
  const family = normalizePart(font?.family || DEFAULT_LOCAL_FONT.family);
  const fullName = normalizePart(font?.fullName || family);
  const postscriptName = normalizePart(font?.postscriptName || fullName);
  const style = normalizePart(font?.style || DEFAULT_LOCAL_FONT.style);

  return {
    family,
    fullName,
    id: getLocalFontId({
      family,
      fullName,
      postscriptName,
      style,
    }),
    postscriptName,
    style,
  };
};

export const createLocalFontDescriptor = (
  font: Partial<LocalFontDescriptor> | null | undefined
): LocalFontDescriptor => {
  const option = createLocalFontOption(font);

  return {
    family: option.family,
    fullName: option.fullName,
    postscriptName: option.postscriptName,
    style: option.style,
  };
};

export const areLocalFontsEqual = (
  left: Partial<LocalFontDescriptor> | null | undefined,
  right: Partial<LocalFontDescriptor> | null | undefined
) => {
  return (
    getLocalFontId(left || DEFAULT_LOCAL_FONT) ===
    getLocalFontId(right || DEFAULT_LOCAL_FONT)
  );
};

export const getLocalFontLabel = (
  font: Partial<LocalFontDescriptor> | null | undefined
) => {
  return createLocalFontOption(font).fullName;
};

export const getLocalFontSearchText = (
  font: Partial<LocalFontDescriptor> | null | undefined
) => {
  const option = createLocalFontOption(font);

  return [option.family, option.fullName, option.postscriptName, option.style]
    .join(" ")
    .toLowerCase();
};
