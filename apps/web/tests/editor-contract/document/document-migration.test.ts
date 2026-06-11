import { describe, expect, test } from "bun:test";
import {
  createRasterAssetId,
  migrateDocument,
  PUNCH_DOCUMENT_VERSION,
  parseDesignDocument,
  UnsupportedDocumentVersionError,
} from "@punchpress/punch-schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const transform = (x: number, y: number, rotation = 0) => ({
  rotation,
  scaleX: 1 as const,
  scaleY: 1 as const,
  x,
  y,
});

const SEGMENT = {
  handleIn: { x: 0, y: 0 },
  handleOut: { x: 0, y: 0 },
  point: { x: 0, y: 0 },
  pointType: "corner" as const,
};

const SEGMENTS = [SEGMENT, SEGMENT, SEGMENT, SEGMENT];

/** A minimal path node that passes designDocumentSchema (modern contours shape). */
const VALID_PATH_NODE = {
  contours: [{ closed: false, segments: SEGMENTS }],
  fill: "#ff0000",
  fillRule: "evenodd" as const,
  id: "path-1",
  opacity: 1,
  parentId: "root",
  stroke: null,
  strokeLineCap: "round" as const,
  strokeLineJoin: "bevel" as const,
  strokeMiterLimit: 4,
  strokeWidth: 0,
  transform: transform(0, 0),
  type: "path" as const,
  visible: true,
};

/** Small 1×1 PNG data URL (from load.test.ts). */
const PIXEL_SRC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/lhL1WQAAAABJRU5ErkJggg==";

/** Minimal image node that passes designDocumentSchema. */
const VALID_IMAGE_NODE = {
  assetId: "asset_image_node",
  height: 1,
  id: "image-node",
  mimeType: "image/png" as const,
  name: "Pixel",
  opacity: 1,
  parentId: "root",
  src: PIXEL_SRC,
  transform: transform(0, 0),
  type: "image" as const,
  visible: true,
  width: 1,
};

// Top-level regex literals (lint/performance/useTopLevelRegex)
const RE_MISSING_VERSION = /missing a supported version/;
const RE_VERSION_0_0_1 = /0\.0\.1/;

// ---------------------------------------------------------------------------
// describe: migrateDocument
// ---------------------------------------------------------------------------

describe("migrateDocument", () => {
  test("rejects non-object input: string", () => {
    expect(() => migrateDocument("hi")).toThrow(
      UnsupportedDocumentVersionError
    );
  });

  test("rejects non-object input: array", () => {
    expect(() => migrateDocument([])).toThrow(UnsupportedDocumentVersionError);
  });

  test("rejects non-object input: null", () => {
    expect(() => migrateDocument(null)).toThrow(
      UnsupportedDocumentVersionError
    );
  });

  test("rejects object with no version property", () => {
    expect(() => migrateDocument({})).toThrow(RE_MISSING_VERSION);
  });

  test("rejects empty-string version", () => {
    expect(() => migrateDocument({ version: "" })).toThrow(RE_MISSING_VERSION);
  });

  test("rejects non-string version (number)", () => {
    expect(() => migrateDocument({ version: 42 })).toThrow(RE_MISSING_VERSION);
  });

  test("rejects unsupported version string and includes version in message", () => {
    expect(() => migrateDocument({ version: "0.0.1" })).toThrow(
      RE_VERSION_0_0_1
    );
  });

  test("passes through current-version document without a nodes array as-is", () => {
    const input = { version: PUNCH_DOCUMENT_VERSION, nodes: undefined };
    const result = migrateDocument(input) as typeof input;
    expect(result.version).toBe(PUNCH_DOCUMENT_VERSION);
    expect(result.nodes).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// describe: document normalization
// ---------------------------------------------------------------------------

describe("document normalization", () => {
  test("upgrades legacy path shape: segments+closed → contours; strips top-level keys", () => {
    const legacyPathNode = {
      fill: "#ff0000",
      fillRule: "evenodd",
      id: "path-legacy",
      parentId: "root",
      stroke: null,
      strokeWidth: 0,
      transform: transform(0, 0),
      type: "path",
      visible: true,
      // legacy shape
      segments: SEGMENTS,
      closed: false,
    };

    const doc = {
      version: PUNCH_DOCUMENT_VERSION,
      nodes: [legacyPathNode],
    };

    const result = migrateDocument(doc) as { nodes: Record<string, unknown>[] };
    const node = result.nodes[0];

    expect(Array.isArray(node.contours)).toBe(true);
    const contours = node.contours as {
      closed: boolean;
      segments: unknown[];
    }[];
    expect(contours).toHaveLength(1);
    expect(contours[0].closed).toBe(false);
    expect(contours[0].segments).toEqual(SEGMENTS);
    expect("segments" in node).toBe(false);
    expect("closed" in node).toBe(false);
  });

  test("upgraded legacy path validates through parseDesignDocument", () => {
    const legacyPathNode = {
      ...VALID_PATH_NODE,
      // replace contours with legacy shape
      contours: undefined,
      segments: SEGMENTS,
      closed: false,
    };

    const json = JSON.stringify({
      version: PUNCH_DOCUMENT_VERSION,
      nodes: [legacyPathNode],
    });

    // Should not throw
    expect(() => parseDesignDocument(json)).not.toThrow();
  });

  test("opacity clamping: value > 1 → 1", () => {
    const doc = {
      version: PUNCH_DOCUMENT_VERSION,
      nodes: [{ type: "empty", id: "n1", parentId: "root", opacity: 7 }],
    };
    const result = migrateDocument(doc) as { nodes: Record<string, unknown>[] };
    expect(result.nodes[0].opacity).toBe(1);
  });

  test("opacity clamping: value < 0 → 0", () => {
    const doc = {
      version: PUNCH_DOCUMENT_VERSION,
      nodes: [{ type: "empty", id: "n1", parentId: "root", opacity: -2 }],
    };
    const result = migrateDocument(doc) as { nodes: Record<string, unknown>[] };
    expect(result.nodes[0].opacity).toBe(0);
  });

  test("opacity defaults to 1 when missing", () => {
    const doc = {
      version: PUNCH_DOCUMENT_VERSION,
      nodes: [{ type: "empty", id: "n1", parentId: "root" }],
    };
    const result = migrateDocument(doc) as { nodes: Record<string, unknown>[] };
    expect(result.nodes[0].opacity).toBe(1);
  });

  test("image node without assetId gets synthesized asset_<sanitized-nodeId>", () => {
    const doc = {
      version: PUNCH_DOCUMENT_VERSION,
      nodes: [
        {
          ...VALID_IMAGE_NODE,
          id: "img/node:1",
          assetId: undefined,
        },
      ],
    };

    const result = migrateDocument(doc) as { nodes: Record<string, unknown>[] };
    const node = result.nodes[0];
    expect(node.assetId).toBe("asset_img_node_1");
  });

  test("createRasterAssetId sanitizes chars outside [a-zA-Z0-9_-]", () => {
    expect(createRasterAssetId("img/node:1")).toBe("asset_img_node_1");
    expect(createRasterAssetId("simple")).toBe("asset_simple");
    expect(createRasterAssetId("a.b.c")).toBe("asset_a_b_c");
  });

  test("asset map constructed from image node via parseDesignDocument", () => {
    const json = JSON.stringify({
      assets: {},
      version: PUNCH_DOCUMENT_VERSION,
      nodes: [VALID_IMAGE_NODE],
    });

    const doc = parseDesignDocument(json);
    const assetId = "asset_image_node";

    expect(doc.assets[assetId]).toMatchObject({
      kind: "raster",
      storage: "single",
      ref: `assets/raster/${assetId}.png`,
    });
  });

  test("pre-existing asset entries are preserved for live nodes", () => {
    const assetId = "asset_image_node";
    const preExistingAsset = {
      colorSpace: "srgb",
      currentMimeType: "image/png",
      hasAlpha: true,
      height: 1,
      id: assetId,
      kind: "raster",
      name: "PreExisting",
      originalMimeType: "image/png",
      preferredExportMimeType: "image/png",
      ref: `assets/raster/${assetId}.png`,
      storage: "single",
      width: 1,
    };

    const json = JSON.stringify({
      assets: { [assetId]: preExistingAsset },
      version: PUNCH_DOCUMENT_VERSION,
      nodes: [VALID_IMAGE_NODE],
    });

    const doc = parseDesignDocument(json);
    // createDocumentAssetsFromNodes only inserts if missing; existing entry retained
    expect(doc.assets[assetId]).toMatchObject({
      name: "PreExisting",
      kind: "raster",
    });
  });
});
