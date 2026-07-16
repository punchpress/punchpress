import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import {
  createPunchPackage,
  encodeDataUrl,
  loadPunchPackageContents,
  PUNCH_DOCUMENT_VERSION,
} from "@punchpress/punch-schema";

const TILE_BYTE_LENGTH = 256 * 1024;

const createTileBytes = (seed: number) => {
  const bytes = new Uint8Array(TILE_BYTE_LENGTH);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = (index * seed + seed) % 256;
  }

  return bytes;
};

const TILE_REFS = [
  "assets/raster/tiled-image/tiles/1_0_0.png",
  "assets/raster/tiled-image/tiles/1_1_0.png",
] as const;

// The base image payload intentionally stays inline on node.src this stage;
// only tile bytes move to the asset store.
const BASE_SRC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/lhL1WQAAAABJRU5ErkJggg==";

const createTransportTiledDocument = () =>
  JSON.stringify({
    nodes: [
      {
        assetId: "asset-tiled-image",
        baseHeight: 1024,
        baseWidth: 1024,
        baseX: 0,
        baseY: 0,
        height: 1024,
        id: "tiled-image",
        mimeType: "image/png",
        name: "Tiled Image",
        opacity: 1,
        parentId: "root",
        src: BASE_SRC,
        tileSources: TILE_REFS.map((ref, index) => ({
          col: index,
          height: 512,
          ref,
          row: 0,
          src: encodeDataUrl(createTileBytes(index + 3), "image/png"),
          width: 512,
          x: index * 512,
          y: 0,
        })),
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "image",
        visible: true,
        width: 1024,
      },
    ],
    version: PUNCH_DOCUMENT_VERSION,
  });

const getImageNode = (editor: Editor) =>
  editor.nodes.find((node) => node.type === "image");

// Tiles must never carry pixel payloads in editor state or serialized
// documents; the base image payload (node.src) intentionally stays inline.
const getManifestTileState = (editor: Editor) => {
  const node = getImageNode(editor);
  const serializedDocument = JSON.parse(editor.serializeDocument());
  const serializedImage = serializedDocument.nodes.find(
    (documentNode) => documentNode.type === "image"
  );

  return {
    serializedTilesHavePixels: JSON.stringify(
      serializedImage.tileSources
    ).includes("data:image"),
    stateTileCount: node?.tileSources?.length || 0,
    stateTilesHavePixels: JSON.stringify(node?.tileSources).includes(
      "data:image"
    ),
  };
};

describe("raster pixels out of document state", () => {
  test("loading a document absorbs inline tile payloads into the asset store", () => {
    const editor = new Editor();

    editor.loadDocument(createTransportTiledDocument());

    const node = getImageNode(editor);

    expect(node?.tileSources?.map((tile) => tile.ref)).toEqual([...TILE_REFS]);

    // Editor state and every history snapshot built from it hold manifests
    // only — no encoded tile payloads.
    expect(getManifestTileState(editor)).toMatchObject({
      serializedTilesHavePixels: false,
      stateTileCount: TILE_REFS.length,
      stateTilesHavePixels: false,
    });
    expect(JSON.stringify(node).length).toBeLessThan(4096);

    for (const [index, ref] of TILE_REFS.entries()) {
      expect(editor.rasterAssets.get(ref)?.bytes).toEqual(
        createTileBytes(index + 3)
      );
    }
  });

  test("a committed tile manifest keeps history snapshots free of pixel bytes", () => {
    const editor = new Editor();

    editor.loadDocument(createTransportTiledDocument());

    // Commit-shaped update: the brush commit path puts encoded bytes into the
    // asset store and appends a src-less manifest entry to the node.
    const commitRef = "assets/raster/tiled-image/tiles/2_0_0.png";

    editor.rasterAssets.put(commitRef, createTileBytes(9), "image/png");

    const mark = editor.markHistoryStep("paint brush stroke");

    editor.run(() => {
      editor.getState().updateNodeById("tiled-image", (node) => ({
        ...node,
        tileSources: [
          ...(node.tileSources || []),
          {
            col: 0,
            height: 256,
            ref: commitRef,
            row: 0,
            width: 256,
            x: 16,
            y: 16,
          },
        ],
      }));
    });
    editor.commitHistoryStep(mark);

    const committedNode = getImageNode(editor);
    const serializedNode = JSON.stringify(committedNode);

    // The stroke's history delta is the node manifest: a few hundred bytes,
    // not the multi-hundred-KB encoded tile payload sitting in the store.
    expect(JSON.stringify(committedNode?.tileSources)).not.toContain(
      "data:image"
    );
    expect(serializedNode.length).toBeLessThan(4096);
    expect(editor.rasterAssets.get(commitRef)?.bytes.length).toBe(
      TILE_BYTE_LENGTH
    );

    // Undo re-renders from the same append-only asset store bytes.
    expect(editor.undo()).toBe(true);
    expect(getImageNode(editor)?.tileSources).toHaveLength(TILE_REFS.length);
    expect(editor.rasterAssets.has(commitRef)).toBe(true);

    expect(editor.redo()).toBe(true);
    expect(getImageNode(editor)?.tileSources).toHaveLength(
      TILE_REFS.length + 1
    );
  });

  test("punch package save and load round-trip manifests and bytes", () => {
    const editor = new Editor();

    editor.loadDocument(createTransportTiledDocument());

    const packageBytes = createPunchPackage(editor.serializeDocument(), {
      getAssetBytes: (ref) => editor.rasterAssets.get(ref),
    });
    const reloadedEditor = new Editor();

    reloadedEditor.loadDocument(loadPunchPackageContents(packageBytes));

    const reloadedNode = getImageNode(reloadedEditor);

    expect(reloadedNode?.tileSources?.map((tile) => tile.ref)).toEqual([
      ...TILE_REFS,
    ]);
    expect(reloadedNode?.src).toBe(BASE_SRC);
    expect(getManifestTileState(reloadedEditor)).toMatchObject({
      serializedTilesHavePixels: false,
      stateTileCount: TILE_REFS.length,
      stateTilesHavePixels: false,
    });

    for (const [index, ref] of TILE_REFS.entries()) {
      expect(reloadedEditor.rasterAssets.get(ref)?.bytes).toEqual(
        createTileBytes(index + 3)
      );
    }
  });

  test("clipboard payloads are self-contained and absorbed on paste", () => {
    const editor = new Editor();

    editor.loadDocument(createTransportTiledDocument());
    editor.setSelectedNodes(["tiled-image"]);

    const content = editor.copySelection();
    const copiedImage = content?.nodes.find((node) => node.type === "image");

    // Copy materializes inline data URLs so the payload outlives this
    // session's asset store.
    expect(
      copiedImage?.tileSources?.every((tile) =>
        tile.src?.startsWith("data:image/png;base64,")
      )
    ).toBe(true);

    const targetEditor = new Editor();

    targetEditor.pasteClipboardContent(content);

    const pastedNode = getImageNode(targetEditor);

    expect(pastedNode?.tileSources?.map((tile) => tile.ref)).toEqual([
      ...TILE_REFS,
    ]);
    expect(getManifestTileState(targetEditor)).toMatchObject({
      serializedTilesHavePixels: false,
      stateTileCount: TILE_REFS.length,
      stateTilesHavePixels: false,
    });

    for (const [index, ref] of TILE_REFS.entries()) {
      expect(targetEditor.rasterAssets.get(ref)?.bytes).toEqual(
        createTileBytes(index + 3)
      );
    }
  });
});
