import { createLocalFontDescriptor } from "../editor/local-fonts";
import { PUNCH_DOCUMENT_VERSION } from "./constants";
import { UnsupportedDocumentVersionError } from "./errors";

const FILE_EXTENSION_RE = /\.[a-z0-9]+$/i;
const SEPARATOR_RE = /[-_]+/g;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

const LEGACY_FONT_BY_URL: Record<
  string,
  ReturnType<typeof createLocalFontDescriptor>
> = {
  "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/anton/Anton-Regular.ttf":
    createLocalFontDescriptor({
      family: "Anton",
      fullName: "Anton Regular",
      postscriptName: "Anton-Regular",
      style: "Regular",
    }),
  "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/bebasneue/BebasNeue-Regular.ttf":
    createLocalFontDescriptor({
      family: "Bebas Neue",
      fullName: "Bebas Neue Regular",
      postscriptName: "BebasNeue-Regular",
      style: "Regular",
    }),
  "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/oswald/Oswald%5Bwght%5D.ttf":
    createLocalFontDescriptor({
      family: "Oswald",
      fullName: "Oswald",
      postscriptName: "Oswald",
      style: "Regular",
    }),
};

const getLegacyFontName = (fontUrl: string) => {
  if (LEGACY_FONT_BY_URL[fontUrl]) {
    return LEGACY_FONT_BY_URL[fontUrl];
  }

  const fileName =
    fontUrl.split("/").at(-1)?.replace(FILE_EXTENSION_RE, "") ||
    "Imported Font";
  const normalizedLabel = decodeURIComponent(fileName)
    .replace(SEPARATOR_RE, " ")
    .trim();

  return createLocalFontDescriptor({
    family: normalizedLabel,
    fullName: normalizedLabel,
    postscriptName: normalizedLabel.replace(/\s+/g, "-"),
    style: "Regular",
  });
};

const migrateV1Document = (value: Record<string, unknown>) => {
  const nodes = Array.isArray(value.nodes) ? value.nodes : [];

  return {
    ...value,
    version: PUNCH_DOCUMENT_VERSION,
    nodes: nodes.map((node) => {
      if (!isRecord(node)) {
        return node;
      }

      const { fontUrl: legacyFontUrl, ...nextNode } = node;
      const fontUrl =
        typeof legacyFontUrl === "string" && legacyFontUrl.trim().length > 0
          ? legacyFontUrl
          : "";

      return {
        ...nextNode,
        font: getLegacyFontName(fontUrl),
      };
    }),
  };
};

export const migrateDocument = (value: unknown) => {
  if (!isRecord(value)) {
    throw new UnsupportedDocumentVersionError(
      "Document must be a JSON object."
    );
  }

  if (value.version === PUNCH_DOCUMENT_VERSION) {
    return value;
  }

  if (value.version === "1.0") {
    return migrateV1Document(value);
  }

  if (typeof value.version !== "string" || value.version.length === 0) {
    throw new UnsupportedDocumentVersionError(
      "Document is missing a supported version."
    );
  }

  throw new UnsupportedDocumentVersionError(
    `Unsupported document version: ${value.version}`
  );
};
