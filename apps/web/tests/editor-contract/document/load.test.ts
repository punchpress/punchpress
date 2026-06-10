import { describe, expect, test } from "bun:test";
import {
  createPunchPackage,
  DocumentParseError,
  DocumentValidationError,
  loadPunchPackageContents,
  PUNCH_DOCUMENT_VERSION,
  parseDesignDocument,
  UnsupportedDocumentVersionError,
} from "@punchpress/punch-schema";

const VALID_DOCUMENT = {
  version: PUNCH_DOCUMENT_VERSION,
  nodes: [
    {
      id: "node_1",
      parentId: "root",
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

  test("rejects previous document versions", () => {
    expect(() =>
      parseDesignDocument(
        JSON.stringify({
          ...VALID_DOCUMENT,
          version: "1.7",
        })
      )
    ).toThrow(UnsupportedDocumentVersionError);
  });
});

describe("Punch package", () => {
  test("stores image payloads as package assets and hydrates them on load", () => {
    const src =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/lhL1WQAAAABJRU5ErkJggg==";
    const contents = JSON.stringify({
      assets: {},
      version: PUNCH_DOCUMENT_VERSION,
      nodes: [
        {
          assetId: "asset_image_node",
          height: 1,
          id: "image-node",
          mimeType: "image/png",
          name: "Pixel",
          opacity: 1,
          parentId: "root",
          src,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 0,
            y: 0,
          },
          type: "image",
          visible: true,
          width: 1,
        },
      ],
    });

    const packageBytes = createPunchPackage(contents);
    const hydrated = parseDesignDocument(
      loadPunchPackageContents(packageBytes)
    );
    const imageNode = hydrated.nodes[0];

    expect(imageNode.type).toBe("image");
    expect(imageNode.type === "image" ? imageNode.src : null).toBe(src);
    expect(hydrated.assets.asset_image_node).toMatchObject({
      currentMimeType: "image/png",
      kind: "raster",
      ref: "assets/raster/asset_image_node.png",
      storage: "single",
    });
  });
});
