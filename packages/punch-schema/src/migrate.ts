import { PUNCH_DOCUMENT_VERSION, ROOT_PARENT_ID } from "./constants";
import { UnsupportedDocumentVersionError } from "./errors";
import { createLocalFontDescriptor } from "./local-fonts";

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
    nodes: withVectorPointTypes(
      withGroupNames(
        nodes.map((node) => {
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
            parentId: ROOT_PARENT_ID,
          };
        })
      )
    ),
  };
};

const migrateV11Document = (value: Record<string, unknown>) => {
  const nodes = Array.isArray(value.nodes) ? value.nodes : [];

  return {
    ...value,
    version: PUNCH_DOCUMENT_VERSION,
    nodes: withVectorPointTypes(
      withGroupNames(
        nodes.map((node) => {
          if (!isRecord(node)) {
            return node;
          }

          return {
            ...node,
            parentId:
              typeof node.parentId === "string" && node.parentId.length > 0
                ? node.parentId
                : ROOT_PARENT_ID,
          };
        })
      )
    ),
  };
};

const withGroupNames = (nodes: unknown[]) => {
  let nextGroupIndex = 1;

  return nodes.map((node) => {
    if (!isRecord(node) || node.type !== "group") {
      return node;
    }

    const name =
      typeof node.name === "string" && node.name.trim().length > 0
        ? node.name
        : `Group ${nextGroupIndex}`;

    nextGroupIndex += 1;

    return {
      ...node,
      name,
    };
  });
};

const withVectorPointTypes = (nodes: unknown[]) => {
  return nodes.map((node) => {
    if (
      !isRecord(node) ||
      node.type !== "vector" ||
      !Array.isArray(node.contours)
    ) {
      return node;
    }

    return {
      ...node,
      contours: node.contours.map((contour) => {
        if (!isRecord(contour) || !Array.isArray(contour.segments)) {
          return contour;
        }

        return {
          ...contour,
          segments: contour.segments.map((segment) => {
            if (!isRecord(segment)) {
              return segment;
            }

            return {
              ...segment,
              pointType:
                segment.pointType === "smooth" || segment.pointType === "corner"
                  ? segment.pointType
                  : "corner",
            };
          }),
        };
      }),
    };
  });
};

const migrateV12Document = (value: Record<string, unknown>) => {
  const nodes = Array.isArray(value.nodes) ? value.nodes : [];

  return {
    ...value,
    version: PUNCH_DOCUMENT_VERSION,
    nodes: withVectorPointTypes(withGroupNames(nodes)),
  };
};

const migrateV13Document = (value: Record<string, unknown>) => {
  return {
    ...value,
    version: PUNCH_DOCUMENT_VERSION,
    nodes: withVectorPointTypes(Array.isArray(value.nodes) ? value.nodes : []),
  };
};

const migrateV14Document = (value: Record<string, unknown>) => {
  return {
    ...value,
    version: PUNCH_DOCUMENT_VERSION,
    nodes: withVectorPointTypes(Array.isArray(value.nodes) ? value.nodes : []),
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

  if (value.version === "1.1") {
    return migrateV11Document(value);
  }

  if (value.version === "1.2") {
    return migrateV12Document(value);
  }

  if (value.version === "1.3") {
    return migrateV13Document(value);
  }

  if (value.version === "1.4") {
    return migrateV14Document(value);
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
