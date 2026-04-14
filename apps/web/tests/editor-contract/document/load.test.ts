import { describe, expect, test } from "bun:test";
import {
  DocumentParseError,
  DocumentValidationError,
  parseDesignDocument,
  UnsupportedDocumentVersionError,
} from "@punchpress/punch-schema";

const VALID_DOCUMENT = {
  version: "1.0",
  nodes: [
    {
      id: "node_1",
      type: "text",
      text: "TEST",
      fontUrl: "/fonts/test.ttf",
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

const LEGACY_VECTOR_DOCUMENT = {
  version: "1.5",
  nodes: [
    {
      contours: [
        {
          closed: true,
          segments: [
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -120, y: -90 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 120, y: -90 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 120, y: 90 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -120, y: 90 },
              pointType: "corner",
            },
          ],
        },
      ],
      fill: "rgba(255, 0, 0, 0.4)",
      fillRule: "evenodd",
      id: "legacy-vector-node",
      parentId: "root",
      stroke: "rgba(0, 0, 0, 0.6)",
      strokeWidth: 12,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 360,
        y: 260,
      },
      type: "vector",
      visible: true,
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

  test("migrates 1.5 vector documents to add durable stroke style fields", () => {
    const document = parseDesignDocument(JSON.stringify(LEGACY_VECTOR_DOCUMENT));
    const vectorNode = document.nodes[0];

    expect(document.version).toBe("1.6");
    expect(vectorNode).toMatchObject({
      strokeLineCap: "round",
      strokeLineJoin: "round",
      strokeMiterLimit: 4,
      type: "vector",
    });
  });
});
