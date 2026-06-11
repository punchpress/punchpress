import {
  parseEmbeddedDesignDocument,
  serializeDesignDocument,
} from "@punchpress/punch-schema";

export type SvgEmbeddedImportResult =
  | { kind: "document"; documentJson: string }
  | { kind: "error"; error: unknown }
  | { kind: "none" };

/**
 * Attempts to extract and parse a punchpress design recipe embedded in an SVG.
 *
 * Returns:
 *   {kind: "document"} — valid embedded document found; open as new tab
 *   {kind: "error"}    — metadata present but corrupt/unsupported; surface error
 *   {kind: "none"}     — no metadata; fall back to geometry import
 */
export const tryParseEmbeddedDocument = (
  svgText: string
): SvgEmbeddedImportResult => {
  try {
    const document = parseEmbeddedDesignDocument(svgText);

    if (document === null) {
      return { kind: "none" };
    }

    return {
      kind: "document",
      documentJson: serializeDesignDocument(document),
    };
  } catch (error) {
    return { kind: "error", error };
  }
};
