import {
  createLocalFontDescriptor,
  getLocalFontId,
  type LocalFontDescriptor,
  type LocalFontOption,
} from "../editor/local-fonts";

type DocumentNode = {
  font: LocalFontDescriptor;
  id: string;
};

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
    const font = createLocalFontDescriptor(node.font);
    const fontId = getLocalFontId(font);

    if (availableFontsById.has(fontId) || missingFontsById.has(fontId)) {
      continue;
    }

    missingFontsById.set(fontId, font);
  }

  return [...missingFontsById.values()];
};

export const replaceMissingDocumentFonts = <TNode extends DocumentNode>(
  nodes: readonly TNode[],
  availableFonts: readonly (LocalFontDescriptor | LocalFontOption)[],
  replacementFont: LocalFontDescriptor | LocalFontOption
) => {
  const missingFonts = getMissingDocumentFonts(nodes, availableFonts);

  if (missingFonts.length === 0) {
    return {
      missingFonts,
      nodes: [...nodes],
      replacementFont: null,
    };
  }

  const missingFontIds = new Set(
    missingFonts.map((font) => getLocalFontId(createLocalFontDescriptor(font)))
  );
  const nextReplacementFont = createLocalFontDescriptor(replacementFont);

  return {
    missingFonts,
    nodes: nodes.map((node) => {
      return missingFontIds.has(getLocalFontId(node.font))
        ? {
            ...node,
            font: nextReplacementFont,
          }
        : node;
    }),
    replacementFont: nextReplacementFont,
  };
};
