import { describe, expect, test } from "bun:test";
import {
  DocumentParseError,
  DocumentValidationError,
  PUNCH_DOCUMENT_VERSION,
  parseDesignDocument,
  UnsupportedDocumentVersionError,
} from "@punchpress/punch-schema";

const VALID_DOCUMENT = {
  version: PUNCH_DOCUMENT_VERSION,
  nodes: [
    {
      id: "node_1",
      type: "text",
      text: "TEST",
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
      warp: {
        kind: "none",
      },
    },
  ],
} as const;

describe("parseDesignDocument", () => {
  test("rejects invalid JSON", () => {
    expect(() => parseDesignDocument("{")).toThrow(DocumentParseError);
  });

  test("rejects unsupported versions", () => {
    expect(() =>
      parseDesignDocument(
        JSON.stringify({
          ...VALID_DOCUMENT,
          version: "2.0",
        })
      )
    ).toThrow(UnsupportedDocumentVersionError);
  });

  test("rejects duplicate node ids", () => {
    expect(() =>
      parseDesignDocument(
        JSON.stringify({
          ...VALID_DOCUMENT,
          nodes: [...VALID_DOCUMENT.nodes, { ...VALID_DOCUMENT.nodes[0] }],
        })
      )
    ).toThrow(DocumentValidationError);
  });

  test("rejects older document versions", () => {
    expect(() =>
      parseDesignDocument(
        JSON.stringify({
          ...VALID_DOCUMENT,
          version: "1.5",
        })
      )
    ).toThrow(UnsupportedDocumentVersionError);
  });
});
