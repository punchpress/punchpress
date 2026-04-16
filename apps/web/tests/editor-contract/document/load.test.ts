import { describe, expect, test } from "bun:test";
import {
  DocumentParseError,
  DocumentValidationError,
  parseDesignDocument,
  PUNCH_DOCUMENT_VERSION,
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

const LEGACY_VECTOR_DOCUMENT = {
  version: "1.6",
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
      strokeLineCap: "round",
      strokeLineJoin: "round",
      strokeMiterLimit: 4,
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

const ALREADY_UPDATED_V16_DOCUMENT = {
  version: "1.6",
  nodes: [
    {
      id: "vector-node",
      name: "Vector",
      parentId: "root",
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
      },
      type: "vector",
      visible: true,
    },
    {
      closed: true,
      fill: "#ffffff",
      fillRule: "nonzero",
      id: "path-node",
      parentId: "vector-node",
      segments: [
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: -100, y: -80 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 100, y: -80 },
          pointType: "corner",
        },
        {
          handleIn: { x: 0, y: 0 },
          handleOut: { x: 0, y: 0 },
          point: { x: 100, y: 80 },
          pointType: "corner",
        },
      ],
      stroke: "#000000",
      strokeLineCap: "round",
      strokeLineJoin: "round",
      strokeMiterLimit: 4,
      strokeWidth: 3,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 320,
        y: 240,
      },
      type: "path",
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

  test("migrates legacy 1.6 vector nodes into vector containers with child paths", () => {
    const document = parseDesignDocument(JSON.stringify(LEGACY_VECTOR_DOCUMENT));

    expect(document.version).toBe(PUNCH_DOCUMENT_VERSION);
    expect(document.nodes).toHaveLength(2);
    expect(document.nodes[0]).toMatchObject({
      id: "legacy-vector-node",
      name: "Vector 1",
      parentId: "root",
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
      },
      type: "vector",
      visible: true,
    });
    expect(document.nodes[1]).toMatchObject({
      closed: true,
      fill: "rgba(255, 0, 0, 0.4)",
      fillRule: "evenodd",
      parentId: "legacy-vector-node",
      stroke: "rgba(0, 0, 0, 0.6)",
      strokeLineCap: "round",
      strokeLineJoin: "round",
      strokeMiterLimit: 4,
      strokeWidth: 12,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 360,
        y: 260,
      },
      type: "path",
      visible: true,
    });
  });

  test("accepts already-updated 1.6 documents by migrating only the version", () => {
    const document = parseDesignDocument(
      JSON.stringify(ALREADY_UPDATED_V16_DOCUMENT)
    );

    expect(document.version).toBe(PUNCH_DOCUMENT_VERSION);
    expect(document.nodes).toMatchObject(ALREADY_UPDATED_V16_DOCUMENT.nodes);
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
