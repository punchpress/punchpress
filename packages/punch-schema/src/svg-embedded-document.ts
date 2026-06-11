import { parseDesignDocument } from "./load";
import type { DesignDocument } from "./schema";

const OPEN_TAG_RE = /<punchpress-document[^>]*>/;
const CLOSE_TAG = "</punchpress-document>";

export const extractEmbeddedDocumentJson = (svgSource: string): string | null => {
  const openMatch = OPEN_TAG_RE.exec(svgSource);

  if (!openMatch) {
    return null;
  }

  const innerStart = openMatch.index + openMatch[0].length;
  const closeIndex = svgSource.indexOf(CLOSE_TAG, innerStart);

  if (closeIndex === -1) {
    return null;
  }

  const escaped = svgSource.slice(innerStart, closeIndex);

  // Unescape in inverted order relative to escapeMetadata in export.ts:
  //   escapeMetadata: & → &amp;  then < → &lt;  then > → &gt;
  //   unescape (reverse): &lt; → <  then &gt; → >  then &amp; → &
  return escaped
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
};

export const parseEmbeddedDesignDocument = (svgSource: string): DesignDocument | null => {
  const json = extractEmbeddedDocumentJson(svgSource);

  if (json === null) {
    return null;
  }

  // Intentionally let parse/validation/version errors propagate.
  return parseDesignDocument(json);
};
