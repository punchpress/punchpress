import {
  createLocalFontDescriptor,
  getLocalFontId,
  type LocalFontDescriptor,
  type LocalFontOption,
} from "./local-fonts";

interface DocumentNode {
  id: string;
  type: string;
  font?: LocalFontDescriptor;
}

const getAvailableFontsById = (
  fonts: readonly (LocalFontDescriptor | LocalFontOption)[]
) => {
  return new Map(
    fonts.map((font) => {
      const descriptor = createLocalFontDescriptor(font);
      return [getLocalFontId(descriptor), descriptor];
    })
  );
};

export const getMissingDocumentFonts = (
  nodes: readonly DocumentNode[],
  availableFonts: readonly (LocalFontDescriptor | LocalFontOption)[]
) => {
  const availableFontsById = getAvailableFontsById(availableFonts);
  const missingFontsById = new Map<string, LocalFontDescriptor>();

  for (const node of nodes) {
    if (node.type !== "text" || !node.font) {
      continue;
    }

    const font = createLocalFontDescriptor(node.font);
    const fontId = getLocalFontId(font);

    if (availableFontsById.has(fontId) || missingFontsById.has(fontId)) {
      continue;
    }

    missingFontsById.set(fontId, font);
  }

  return [...missingFontsById.values()];
};
