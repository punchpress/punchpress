import { describe, expect, test } from "bun:test";
import { Editor, recipeToComponentNodes } from "@punchpress/engine";
import {
  PUNCH_DOCUMENT_VERSION,
  parseEmbeddedDesignDocument,
  ROOT_PARENT_ID,
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

const FONT = {
  family: "Test Sans",
  fullName: "Test Sans Regular",
  postscriptName: "TestSans-Regular",
  style: "Regular",
};

const buildArtboard = (
  id: string,
  x: number,
  y: number,
  width = 800,
  height = 600
) => ({
  background: "#ffffff",
  height,
  id,
  locked: false,
  name: "Artboard",
  opacity: 1,
  parentId: ROOT_PARENT_ID,
  transform: transform(x, y),
  type: "artboard" as const,
  visible: true,
  width,
});

const buildText = (
  id: string,
  parentId: string,
  x: number,
  y: number,
  text = "Hello"
) => ({
  fill: "#000000",
  font: FONT,
  fontSize: 120,
  id,
  opacity: 1,
  parentId,
  stroke: null,
  strokeWidth: 0,
  text,
  tracking: 0,
  transform: transform(x, y),
  type: "text" as const,
  visible: true,
  warp: { kind: "none" as const },
});

const PIXEL_SRC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/lhL1WQAAAABJRU5ErkJggg==";

const buildImage = (
  id: string,
  parentId: string,
  x: number,
  y: number,
  src: string
) => ({
  assetId: `asset_${id}`,
  height: 1,
  id,
  mimeType: "image/png" as const,
  name: "Pixel",
  opacity: 1,
  parentId,
  src,
  transform: transform(x, y),
  type: "image" as const,
  visible: true,
  width: 1,
});

const buildDocument = (nodes: Record<string, unknown>[]) => ({
  assets: {},
  nodes,
  version: PUNCH_DOCUMENT_VERSION,
});

// ---------------------------------------------------------------------------
// describe: recipeToComponentNodes
// ---------------------------------------------------------------------------

describe("recipeToComponentNodes", () => {
  test("artboard + text child: one group (no artboard), text under group, fresh ids, content box centered on targetCenter", () => {
    const artboard = buildArtboard("artboard-1", 100, 200, 800, 600);
    const text = buildText("text-1", "artboard-1", 100 + 300, 200 + 250);
    const document = buildDocument([artboard, text]);

    const { nodes, skippedImageCount } = recipeToComponentNodes(document, {
      targetCenter: { x: 1000, y: 1000 },
    });

    expect(skippedImageCount).toBe(0);
    expect(nodes).toHaveLength(2);

    const group = nodes.find((node) => node.type === "group");
    const textNode = nodes.find((node) => node.type === "text");

    expect(group).toBeDefined();
    expect(textNode).toBeDefined();

    // No artboard survives.
    expect(nodes.some((node) => node.type === "artboard")).toBe(false);

    // All ids are fresh (none match the source ids).
    expect(group?.id).not.toBe("artboard-1");
    expect(textNode?.id).not.toBe("text-1");

    // Text is reparented under the fresh group.
    expect(textNode?.parentId).toBe(group?.id);

    // Content box (artboard-exact case): artboard frame is x=100,y=200,w=800,h=600
    // -> center (500, 500). Offset to targetCenter (1000, 1000) is (+500, +500).
    expect(textNode?.transform.x).toBeCloseTo(100 + 300 + 500, 5);
    expect(textNode?.transform.y).toBeCloseTo(200 + 250 + 500, 5);
  });

  test("two sibling artboards: both stripped, all children under one group", () => {
    const artboardA = buildArtboard("artboard-a", 0, 0);
    const artboardB = buildArtboard("artboard-b", 1000, 0);
    const textA = buildText("text-a", "artboard-a", 100, 100);
    const textB = buildText("text-b", "artboard-b", 1100, 100);
    const document = buildDocument([artboardA, textA, artboardB, textB]);

    const { nodes } = recipeToComponentNodes(document, {
      targetCenter: { x: 0, y: 0 },
    });

    const groups = nodes.filter((node) => node.type === "group");
    const artboards = nodes.filter((node) => node.type === "artboard");
    const texts = nodes.filter((node) => node.type === "text");

    expect(groups).toHaveLength(1);
    expect(artboards).toHaveLength(0);
    expect(texts).toHaveLength(2);
    expect(texts.every((node) => node.parentId === groups[0].id)).toBe(true);
  });

  test("image node with data-url src inserted intact; image node with empty src skipped and counted", () => {
    const artboard = buildArtboard("artboard-1", 0, 0);
    const goodImage = buildImage(
      "image-good",
      "artboard-1",
      100,
      100,
      PIXEL_SRC
    );
    const emptyImage = buildImage("image-empty", "artboard-1", 200, 200, "");
    const document = buildDocument([artboard, goodImage, emptyImage]);

    const { nodes, skippedImageCount } = recipeToComponentNodes(document, {
      targetCenter: { x: 0, y: 0 },
    });

    expect(skippedImageCount).toBe(1);

    const images = nodes.filter((node) => node.type === "image");
    expect(images).toHaveLength(1);
    expect(images[0].src).toBe(PIXEL_SRC);
    expect(images[0].id).not.toBe("image-good");
  });

  test("same recipe converted twice: zero id overlap", () => {
    const artboard = buildArtboard("artboard-1", 0, 0);
    const text = buildText("text-1", "artboard-1", 100, 100);
    const document = buildDocument([artboard, text]);

    const first = recipeToComponentNodes(document, {
      targetCenter: { x: 0, y: 0 },
    });
    const second = recipeToComponentNodes(document, {
      targetCenter: { x: 0, y: 0 },
    });

    const firstIds = new Set(first.nodes.map((node) => node.id));
    const overlap = second.nodes.filter((node) => firstIds.has(node.id));

    expect(overlap).toHaveLength(0);
  });

  test("end-to-end: real exporter document converts and inserts via editor.insertNodes", async () => {
    const editor = new Editor();
    editor.addArtboardNode({ x: 0, y: 0 });
    editor.setNextShapeKind("star");
    editor.addShapeNode({ x: 500, y: 500 });

    const svg = await editor.exportDocument();
    const recovered = parseEmbeddedDesignDocument(svg);

    expect(recovered).not.toBeNull();
    if (!recovered) {
      return;
    }

    const originalArtboardCount = editor.nodes.filter(
      (node) => node.type === "artboard"
    ).length;
    const nodeCountBefore = editor.nodes.length;
    const { nodes, skippedImageCount } = recipeToComponentNodes(recovered, {
      targetCenter: { x: 2000, y: 2000 },
    });

    expect(skippedImageCount).toBe(0);
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.some((node) => node.type === "artboard")).toBe(false);

    editor.insertNodes(nodes);

    expect(editor.nodes.length).toBe(nodeCountBefore + nodes.length);
    // No new artboard was added by the drop-insert path.
    expect(editor.nodes.filter((node) => node.type === "artboard").length).toBe(
      originalArtboardCount
    );

    const insertedShape = editor.nodes.find(
      (node) => node.type === "shape" && nodes.some((n) => n.id === node.id)
    );
    expect(insertedShape).toBeDefined();
    expect(insertedShape?.type === "shape" ? insertedShape.shape : null).toBe(
      "star"
    );
  });
});
