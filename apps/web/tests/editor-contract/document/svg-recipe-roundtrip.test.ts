import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import {
  DocumentParseError,
  extractEmbeddedDocumentJson,
  PUNCH_DOCUMENT_VERSION,
  parseEmbeddedDesignDocument,
  UnsupportedDocumentVersionError,
} from "@punchpress/punch-schema";

// Mirrors escapeMetadata from packages/engine/src/document/export.ts
const escapeMetadata = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const wrapInSvgMetadata = (documentJson: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg"><metadata><punchpress-document version="${PUNCH_DOCUMENT_VERSION}">${escapeMetadata(documentJson)}</punchpress-document></metadata></svg>`;

describe("extractEmbeddedDocumentJson", () => {
  test("returns null when no punchpress-document tag is present", () => {
    expect(extractEmbeddedDocumentJson("<svg></svg>")).toBeNull();
    expect(extractEmbeddedDocumentJson("")).toBeNull();
  });

  test("returns null when opening tag present but closing tag missing", () => {
    const malformed =
      '<svg><metadata><punchpress-document version="1.9">oops</svg>';
    expect(extractEmbeddedDocumentJson(malformed)).toBeNull();
  });

  test("extracts and unescapes JSON from a well-formed SVG", () => {
    const doc = JSON.stringify({ version: PUNCH_DOCUMENT_VERSION, nodes: [] });
    const svg = wrapInSvgMetadata(doc);
    const result = extractEmbeddedDocumentJson(svg);
    expect(result).toBe(doc);
  });

  test("correctly unescapes special characters (amp last, inverts escapeMetadata)", () => {
    const special = `A & <B> "C"`;
    const escaped = escapeMetadata(special);
    const svg = `<svg><metadata><punchpress-document version="${PUNCH_DOCUMENT_VERSION}">${escaped}</punchpress-document></metadata></svg>`;
    expect(extractEmbeddedDocumentJson(svg)).toBe(special);
  });
});

describe("parseEmbeddedDesignDocument", () => {
  test("returns null when no metadata is present", () => {
    expect(parseEmbeddedDesignDocument("<svg></svg>")).toBeNull();
  });

  test("throws DocumentParseError for corrupt inner JSON", () => {
    const svg =
      `<svg><metadata><punchpress-document version="${PUNCH_DOCUMENT_VERSION}">` +
      escapeMetadata("{not: valid json}") +
      "</punchpress-document></metadata></svg>";
    expect(() => parseEmbeddedDesignDocument(svg)).toThrow(DocumentParseError);
  });

  test("throws UnsupportedDocumentVersionError for unsupported embedded version", () => {
    const badVersionDoc = JSON.stringify({
      version: "2.0",
      nodes: [],
    });
    const svg = wrapInSvgMetadata(badVersionDoc);
    expect(() => parseEmbeddedDesignDocument(svg)).toThrow(
      UnsupportedDocumentVersionError
    );
  });

  test("end-to-end: exportDocument embeds recipe that round-trips back to the original document", async () => {
    const editor = new Editor();
    editor.setNextShapeKind("star");
    editor.addShapeNode({ x: 480, y: 360 });

    const originalDocument = editor.getDocument();
    const svg = await editor.exportDocument();

    const recovered = parseEmbeddedDesignDocument(svg);

    expect(recovered).not.toBeNull();
    expect(recovered).toEqual(originalDocument);
  });

  test("text node with special characters round-trips without corruption", () => {
    const VALID_DOCUMENT = {
      version: PUNCH_DOCUMENT_VERSION,
      nodes: [
        {
          id: "node_1",
          parentId: "root",
          type: "text",
          text: `A & <B> "C"`,
          font: {
            family: "Test Sans",
            fullName: "Test Sans Regular",
            postscriptName: "TestSans-Regular",
            style: "Regular",
          },
          transform: {
            x: 100,
            y: 200,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          fontSize: 120,
          tracking: 0,
          fill: "#000000",
          stroke: null,
          strokeWidth: 0,
          visible: true,
          warp: { kind: "none" },
        },
      ],
    };

    const svg = wrapInSvgMetadata(JSON.stringify(VALID_DOCUMENT));
    const recovered = parseEmbeddedDesignDocument(svg);

    expect(recovered).not.toBeNull();
    expect(
      recovered?.nodes[0].type === "text" ? recovered.nodes[0].text : null
    ).toBe(`A & <B> "C"`);
  });
});
