import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import {
  createPunchPackage,
  encodeDataUrl,
  loadPunchPackageContents,
  PUNCH_DOCUMENT_VERSION,
} from "@punchpress/punch-schema";
import { RasterAssetStore } from "../../../../packages/engine/src/raster/raster-asset-store";
import {
  createStoreTileSource,
  getManifestEntryStoreKey,
  getReplacedTileSources,
  getStoreTileKey,
  getTiledImageCommitState,
  isPureTiledImageNode,
  type RasterTileSource,
} from "../../../../packages/engine/src/raster/raster-commit";
import {
  captureTileDeltasBeforeMerge,
  createStrokeCapture,
} from "../../../../packages/engine/src/raster/raster-history";
import {
  commitMergedStrokeBounds,
  mergeStrokeStoreTile,
  RasterTileStore,
} from "../../../../packages/engine/src/raster/raster-tile-store";

const BASE_SRC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/lhL1WQAAAABJRU5ErkJggg==";

interface Point {
  x: number;
  y: number;
}

interface Bounds {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

/**
 * Headless tile codec: the canvas PNG encoder is a browser seam, so contract
 * tests round-trip raw RGBA payloads through the asset store instead. The
 * manifest math under test is codec-agnostic.
 */
const encodeRawTilePixels = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number
) => `raw:${width}:${height}:${Buffer.from(pixels).toString("base64")}`;

const decodeRawTilePayload = (dataUrl: string) => {
  const [, width, height, base64] = dataUrl.split(":");

  return {
    height: Number(height),
    pixels: new Uint8ClampedArray(Buffer.from(base64, "base64")),
    width: Number(width),
  };
};

/** Circle-envelope dabs along a polyline, optionally semi-transparent. */
const paintStroke = (
  store: RasterTileStore,
  polyline: Point[],
  size: number,
  { color = { b: 40, g: 90, r: 200 }, opacity = 1 } = {}
) => {
  const radius = size / 2;
  const spacing = Math.max(1, radius / 2);
  const dab = (point: Point) => {
    store.paintDab({
      bounds: {
        maxX: Math.ceil(point.x + radius + 1),
        maxY: Math.ceil(point.y + radius + 1),
        minX: Math.floor(point.x - radius - 1),
        minY: Math.floor(point.y - radius - 1),
      },
      color,
      getCoverage: (x, y, center) => {
        const distance = Math.hypot(x - center.x, y - center.y);

        return Math.min(1, Math.max(0, radius + 0.5 - distance));
      },
      opacity,
      point,
    });
  };

  dab(polyline[0]);

  for (let index = 1; index < polyline.length; index += 1) {
    const from = polyline[index - 1];
    const to = polyline[index];
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / spacing)
    );

    for (let step = 1; step <= steps; step += 1) {
      dab({
        x: from.x + ((to.x - from.x) * step) / steps,
        y: from.y + ((to.y - from.y) * step) / steps,
      });
    }
  }
};

/**
 * Merge a stroke store into the committed store exactly as
 * BrushStrokeSession.mergeStrokeStoreBudgeted does, returning the touched
 * store tiles and merged bounds the commit projection consumes.
 */
const mergeStroke = (
  store: RasterTileStore,
  strokeStore: RasterTileStore,
  { anchorX = 0, anchorY = 0, mode = "paint" as "erase" | "paint" } = {}
) => {
  const touchedTiles = new Set<
    ReturnType<RasterTileStore["getOrCreateTile"]>
  >();
  const capture = createStrokeCapture({
    anchorBefore: { x: anchorX, y: anchorY },
    mergeAnchorX: anchorX,
    mergeAnchorY: anchorY,
    operation: mode,
  });
  const strokeBounds = strokeStore.getPaintedBounds();

  if (!strokeBounds) {
    return { capture, mergedBounds: null, touchedTiles };
  }

  for (const strokeTile of strokeStore.getTilesForBounds(strokeBounds, {
    create: false,
  })) {
    captureTileDeltasBeforeMerge({
      anchorX,
      anchorY,
      capture,
      store,
      strokeTile,
    });

    for (const touchedTile of mergeStrokeStoreTile({
      anchorX,
      anchorY,
      mode,
      store,
      strokeTile,
    })) {
      touchedTiles.add(touchedTile);
    }

    strokeTile.merged = true;
  }

  const mergedBounds = commitMergedStrokeBounds({
    anchorX,
    anchorY,
    store,
    strokeBounds,
  });

  return { capture, mergedBounds, touchedTiles };
};

/**
 * The commit projection exactly as BrushStrokeSession.commitStoreTiles wires
 * it: purity decides migrate-vs-replace, encode clamps to the node's
 * legitimate plane region, replaced keys swap manifest entries.
 */
const commitStoreTiles = ({
  anchorX = 0,
  anchorY = 0,
  assets,
  commitRevision,
  mergedBounds = null,
  node,
  store,
  touchedTiles,
  trimToTiles = false,
}: {
  anchorX?: number;
  anchorY?: number;
  assets: RasterAssetStore;
  commitRevision: number;
  mergedBounds?: Bounds | null;
  node: Record<string, unknown>;
  store: RasterTileStore;
  touchedTiles: ReadonlySet<{ col: number; row: number }>;
  trimToTiles?: boolean;
}) => {
  const pure = isPureTiledImageNode(node, { anchorX, anchorY });
  const planeBounds = {
    maxX: (node.width as number) - anchorX,
    maxY: (node.height as number) - anchorY,
    minX: -anchorX,
    minY: -anchorY,
  };
  const clampBounds = mergedBounds
    ? {
        maxX: Math.max(planeBounds.maxX, mergedBounds.maxX),
        maxY: Math.max(planeBounds.maxY, mergedBounds.maxY),
        minX: Math.min(planeBounds.minX, mergedBounds.minX),
        minY: Math.min(planeBounds.minY, mergedBounds.minY),
      }
    : planeBounds;
  const dirtyTiles = pure
    ? [...touchedTiles]
    : store.getTilesForBounds(clampBounds, { create: false });
  const replacedKeys = new Set(
    pure ? dirtyTiles.map((tile) => getStoreTileKey(tile.col, tile.row)) : []
  );
  const tileSources = dirtyTiles.flatMap((tile) => {
    const tileSource = createStoreTileSource({
      anchorX,
      anchorY,
      assets,
      clampBounds,
      commitRevision,
      encodeTilePixels: encodeRawTilePixels,
      nodeId: node.id as string,
      tile: tile as never,
    });

    return tileSource ? [tileSource] : [];
  });
  const nextTileSources = pure
    ? getReplacedTileSources({
        anchorX,
        anchorY,
        existingTileSources:
          (node.tileSources as RasterTileSource[] | undefined) || [],
        replacedKeys,
        tileSources,
      })
    : tileSources;

  return {
    ...getTiledImageCommitState({
      node: node as never,
      tileSources: nextTileSources,
      trimToTiles,
    }),
    pure,
  };
};

/** Rebuild a store from manifest payloads, mirroring hydration's math. */
const hydrateManifestIntoStore = (
  tileSources: RasterTileSource[],
  assets: RasterAssetStore,
  { anchorX = 0, anchorY = 0 } = {}
) => {
  const store = new RasterTileStore();

  for (const tileSource of tileSources) {
    const payload = decodeRawTilePayload(
      assets.get(tileSource.ref)?.dataUrl || ""
    );
    const rect = {
      maxX: tileSource.x - anchorX + tileSource.width,
      maxY: tileSource.y - anchorY + tileSource.height,
      minX: tileSource.x - anchorX,
      minY: tileSource.y - anchorY,
    };

    for (const tile of store.getTilesForBounds(rect, { create: true })) {
      const minX = Math.max(tile.x, rect.minX);
      const minY = Math.max(tile.y, rect.minY);
      const maxX = Math.min(tile.x + tile.width, rect.maxX);
      const maxY = Math.min(tile.y + tile.height, rect.maxY);

      for (let y = minY; y < maxY; y += 1) {
        for (let x = minX; x < maxX; x += 1) {
          const sourceOffset =
            ((y - rect.minY) * payload.width + (x - rect.minX)) * 4;
          const targetOffset = ((y - tile.y) * tile.width + (x - tile.x)) * 4;

          for (let channel = 0; channel < 4; channel += 1) {
            tile.pixels[targetOffset + channel] =
              payload.pixels[sourceOffset + channel];
          }
        }
      }

      tile.revision += 1;
    }
  }

  return store;
};

/**
 * First visible pixel difference between two stores across every physical
 * pixel of every tile. Fully transparent pixels compare equal regardless of
 * RGB residue (erase clears alpha only) and missing tiles count as blank.
 */
const findVisibleMismatch = (
  expected: RasterTileStore,
  actual: RasterTileStore
) => {
  const keys = new Set([...expected.tiles.keys(), ...actual.tiles.keys()]);

  for (const key of keys) {
    const expectedPixels = expected.tiles.get(key)?.pixels;
    const actualPixels = actual.tiles.get(key)?.pixels;
    const length = expectedPixels?.length ?? actualPixels?.length ?? 0;

    for (let offset = 0; offset < length; offset += 4) {
      const expectedAlpha = expectedPixels?.[offset + 3] ?? 0;
      const actualAlpha = actualPixels?.[offset + 3] ?? 0;

      if (expectedAlpha !== actualAlpha) {
        return { actualAlpha, expectedAlpha, offset, tile: key };
      }

      if (expectedAlpha === 0) {
        continue;
      }

      for (let channel = 0; channel < 3; channel += 1) {
        const expectedByte = expectedPixels?.[offset + channel] ?? 0;
        const actualByte = actualPixels?.[offset + channel] ?? 0;

        if (expectedByte !== actualByte) {
          return { actualByte, expectedByte, offset, tile: key };
        }
      }
    }
  }

  return null;
};

const snapshotStore = (store: RasterTileStore) => {
  const snapshot = new RasterTileStore();

  for (const tile of store.tiles.values()) {
    const copy = snapshot.getOrCreateTile(tile.col, tile.row);

    copy.pixels.set(tile.pixels);
  }

  return snapshot;
};

const createLegacyMixedNode = () => ({
  height: 800,
  id: "legacy-image",
  mimeType: "image/png",
  src: BASE_SRC,
  tileSources: [
    // Old append-shaped overlay entries: stroke-trimmed rects that ignore
    // the store grid, stacked across commits.
    {
      col: 0,
      height: 300,
      ref: "legacy/tiles/1_0_0.png",
      row: 0,
      width: 700,
      x: 180,
      y: 120,
    },
    {
      col: 0,
      height: 260,
      ref: "legacy/tiles/2_0_0.png",
      row: 0,
      width: 420,
      x: 300,
      y: 200,
    },
  ],
  transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
  type: "image",
  width: 1200,
});

describe("pure-tiled manifest shape", () => {
  test("purity requires src-less, grid-aligned, unique-key manifests", () => {
    const alignedEntries = [
      { col: 0, height: 512, ref: "a", row: 0, width: 512, x: 0, y: 0 },
      { col: 1, height: 200, ref: "b", row: 0, width: 100, x: 600, y: 40 },
    ];
    const pureNode = {
      height: 800,
      tileSources: alignedEntries,
      width: 1200,
    };

    expect(isPureTiledImageNode(pureNode)).toBe(true);
    expect(isPureTiledImageNode({ ...pureNode, src: BASE_SRC })).toBe(false);
    // Duplicate store key.
    expect(
      isPureTiledImageNode({
        ...pureNode,
        tileSources: [
          ...alignedEntries,
          { col: 0, height: 8, ref: "c", row: 0, width: 8, x: 4, y: 4 },
        ],
      })
    ).toBe(false);
    // Entry crossing a store tile boundary (legacy append shape).
    expect(
      isPureTiledImageNode({
        ...pureNode,
        tileSources: [
          { col: 0, height: 100, ref: "d", row: 0, width: 300, x: 400, y: 0 },
        ],
      })
    ).toBe(false);
    // A reloaded manifest whose grid drifted off the fresh store's tiling
    // (the old session's anchor offset) re-migrates instead of replacing.
    expect(isPureTiledImageNode(pureNode, { anchorX: 100, anchorY: 0 })).toBe(
      false
    );
  });
});

describe("migration commit", () => {
  test("a legacy base+overlay node emerges pure-tiled with identical pixels", () => {
    const assets = new RasterAssetStore();
    const store = new RasterTileStore();

    // Hydrated committed content: solid and semi-transparent strokes across
    // tile boundaries stand in for the absorbed base + overlay pixels.
    paintStroke(
      store,
      [
        { x: 200, y: 200 },
        { x: 900, y: 260 },
      ],
      160
    );
    paintStroke(
      store,
      [
        { x: 380, y: 120 },
        { x: 700, y: 640 },
      ],
      120,
      {
        color: { b: 10, g: 200, r: 20 },
        opacity: 0.5,
      }
    );

    const node = createLegacyMixedNode();
    const { mergedBounds, touchedTiles } = mergeStroke(
      store,
      paintIntoStrokeStore(
        [
          { x: 500, y: 500 },
          { x: 640, y: 520 },
        ],
        80
      )
    );
    const commit = commitStoreTiles({
      assets,
      commitRevision: 1,
      mergedBounds,
      node,
      store,
      touchedTiles,
    });

    expect(commit.pure).toBe(false);

    const committedNode = commit.node;

    // Pure-tiled: no src, no base frame, one aligned entry per painted tile.
    expect(committedNode.src).toBeUndefined();
    expect(committedNode.baseX).toBeUndefined();
    expect(committedNode.baseY).toBeUndefined();
    expect(committedNode.baseWidth).toBeUndefined();
    expect(committedNode.baseHeight).toBeUndefined();
    expect(commit.offsetX).toBe(0);
    expect(commit.offsetY).toBe(0);
    expect(
      isPureTiledImageNode(committedNode, { anchorX: 0, anchorY: 0 })
    ).toBe(true);

    // Every non-blank store tile has exactly one manifest entry.
    const entryKeys = new Set(
      committedNode.tileSources.map((tileSource) =>
        getManifestEntryStoreKey(tileSource, 0, 0)
      )
    );

    expect(entryKeys.size).toBe(committedNode.tileSources.length);

    // Hydrating the new manifest into a fresh store reproduces the store.
    const hydrated = hydrateManifestIntoStore(
      committedNode.tileSources,
      assets
    );

    expect(findVisibleMismatch(store, hydrated)).toBeNull();
  });

  test("negative-coordinate strokes rebase the manifest and keep entries in-plane", () => {
    const assets = new RasterAssetStore();
    const store = new RasterTileStore();
    const { mergedBounds, touchedTiles } = mergeStroke(
      store,
      paintIntoStrokeStore(
        [
          { x: -80, y: -40 },
          { x: 200, y: 160 },
        ],
        60
      )
    );
    const node = {
      height: 400,
      id: "grow-left",
      src: BASE_SRC,
      transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 500, y: 500 },
      type: "image",
      width: 400,
    };
    const commit = commitStoreTiles({
      assets,
      commitRevision: 1,
      mergedBounds,
      node,
      store,
      touchedTiles,
    });

    expect(commit.offsetX).toBeGreaterThan(0);
    expect(commit.offsetY).toBeGreaterThan(0);
    expect(commit.node.width).toBeGreaterThan(400);
    expect(
      commit.node.tileSources.every(
        (tileSource) =>
          tileSource.x >= 0 &&
          tileSource.y >= 0 &&
          tileSource.x + tileSource.width <= commit.node.width &&
          tileSource.y + tileSource.height <= commit.node.height
      )
    ).toBe(true);
    expect(
      isPureTiledImageNode(commit.node, {
        anchorX: commit.offsetX,
        anchorY: commit.offsetY,
      })
    ).toBe(true);

    const hydrated = hydrateManifestIntoStore(commit.node.tileSources, assets, {
      anchorX: commit.offsetX,
      anchorY: commit.offsetY,
    });

    expect(findVisibleMismatch(store, hydrated)).toBeNull();
  });
});

const paintIntoStrokeStore = (
  polyline: Point[],
  size: number,
  options = {}
) => {
  const strokeStore = new RasterTileStore();

  paintStroke(strokeStore, polyline, size, options);
  return strokeStore;
};

describe("per-tile replace commits", () => {
  test("repeated strokes over the same region keep the manifest size constant", () => {
    const assets = new RasterAssetStore();
    const store = new RasterTileStore();
    let node: Record<string, unknown> = {
      height: 800,
      id: "steady-node",
      src: BASE_SRC,
      transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
      type: "image",
      width: 1200,
    };
    const manifestSizes: number[] = [];
    const refsPerCommit: string[][] = [];

    for (let stroke = 0; stroke < 6; stroke += 1) {
      const { mergedBounds, touchedTiles } = mergeStroke(
        store,
        paintIntoStrokeStore(
          [
            { x: 300 + stroke * 4, y: 300 },
            { x: 700, y: 340 + stroke * 3 },
          ],
          120
        )
      );
      const commit = commitStoreTiles({
        assets,
        commitRevision: stroke + 1,
        mergedBounds,
        node,
        store,
        touchedTiles,
      });

      expect(commit.pure).toBe(stroke > 0);
      node = commit.node;
      manifestSizes.push(commit.node.tileSources.length);
      refsPerCommit.push(
        commit.node.tileSources.map((tileSource) => tileSource.ref)
      );
    }

    // Same painted region forever: the manifest never grows past the first
    // commit's tile coverage, while every commit swaps in fresh refs.
    expect(new Set(manifestSizes).size).toBe(1);

    for (let stroke = 1; stroke < refsPerCommit.length; stroke += 1) {
      expect(refsPerCommit[stroke]).not.toEqual(refsPerCommit[stroke - 1]);
      expect(new Set(refsPerCommit[stroke]).size).toBe(
        refsPerCommit[stroke].length
      );
    }

    // The final manifest still reproduces the store byte-for-byte.
    const hydrated = hydrateManifestIntoStore(
      node.tileSources as RasterTileSource[],
      assets
    );

    expect(findVisibleMismatch(store, hydrated)).toBeNull();
  });

  test("a replace commit leaves untouched entries alone and swaps touched ones", () => {
    const assets = new RasterAssetStore();
    const store = new RasterTileStore();
    const first = mergeStroke(
      store,
      paintIntoStrokeStore(
        [
          { x: 100, y: 100 },
          { x: 200, y: 120 },
        ],
        60
      )
    );
    let node: Record<string, unknown> = commitStoreTiles({
      assets,
      commitRevision: 1,
      mergedBounds: first.mergedBounds,
      node: {
        height: 1600,
        id: "two-region",
        src: BASE_SRC,
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "image",
        width: 1600,
      },
      store,
      touchedTiles: first.touchedTiles,
    }).node;

    const untouchedRefs = (node.tileSources as RasterTileSource[]).map(
      (tileSource) => tileSource.ref
    );

    // Second stroke in a disjoint tile region.
    const second = mergeStroke(
      store,
      paintIntoStrokeStore(
        [
          { x: 1200, y: 1200 },
          { x: 1300, y: 1240 },
        ],
        60
      )
    );
    const commit = commitStoreTiles({
      assets,
      commitRevision: 2,
      mergedBounds: second.mergedBounds,
      node,
      store,
      touchedTiles: second.touchedTiles,
    });

    expect(commit.pure).toBe(true);
    node = commit.node;

    const refs = (node.tileSources as RasterTileSource[]).map(
      (tileSource) => tileSource.ref
    );

    for (const ref of untouchedRefs) {
      expect(refs).toContain(ref);
    }

    expect(refs.length).toBeGreaterThan(untouchedRefs.length);
  });

  test("erasing a region to empty drops its manifest entries", () => {
    const assets = new RasterAssetStore();
    const store = new RasterTileStore();
    const paint = mergeStroke(
      store,
      paintIntoStrokeStore(
        [
          { x: 200, y: 200 },
          { x: 400, y: 220 },
        ],
        80
      )
    );
    let node: Record<string, unknown> = commitStoreTiles({
      assets,
      commitRevision: 1,
      mergedBounds: paint.mergedBounds,
      node: {
        height: 800,
        id: "erase-node",
        src: BASE_SRC,
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "image",
        width: 800,
      },
      store,
      touchedTiles: paint.touchedTiles,
    }).node;

    expect((node.tileSources as RasterTileSource[]).length).toBeGreaterThan(0);

    // Erase everything the paint stroke covered (wider, fully opaque).
    const erase = mergeStroke(
      store,
      paintIntoStrokeStore(
        [
          { x: 200, y: 200 },
          { x: 400, y: 220 },
        ],
        160
      ),
      { mode: "erase" }
    );
    const commit = commitStoreTiles({
      assets,
      commitRevision: 2,
      mergedBounds: erase.mergedBounds,
      node,
      store,
      touchedTiles: erase.touchedTiles,
    });

    expect(commit.pure).toBe(true);
    node = commit.node;
    expect(node.tileSources as RasterTileSource[]).toHaveLength(0);
    expect(node.src).toBeUndefined();
    // The fully-erased layer keeps its plane.
    expect(node.width).toBe(800);
    expect(node.height).toBe(800);
  });
});

const createSrcImageDocument = (nodeId: string) =>
  JSON.stringify({
    nodes: [
      {
        height: 800,
        id: nodeId,
        mimeType: "image/png",
        name: nodeId,
        opacity: 1,
        parentId: "root",
        src: BASE_SRC,
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "image",
        visible: true,
        width: 1200,
      },
    ],
    version: PUNCH_DOCUMENT_VERSION,
  });

describe("undo/redo across the migration commit", () => {
  test("undo restores the pre-migration node and pixels; redo re-produces the migrated manifest", () => {
    const editor = new Editor();

    editor.loadDocument(createSrcImageDocument("migrating-node"));

    const entry = editor.rasterStores.getOrCreateEntry("migrating-node");

    entry.hydrated = true;

    // Committed content standing in for the hydrated base image.
    paintStroke(
      entry.store,
      [
        { x: 150, y: 150 },
        { x: 600, y: 180 },
      ],
      100
    );

    const preStrokeSnapshot = snapshotStore(entry.store);
    const strokeStore = paintIntoStrokeStore(
      [
        { x: 400, y: 300 },
        { x: 700, y: 500 },
      ],
      120,
      { color: { b: 200, g: 40, r: 30 }, opacity: 0.6 }
    );
    const { capture, mergedBounds, touchedTiles } = mergeStroke(
      entry.store,
      strokeStore
    );
    const postStrokeSnapshot = snapshotStore(entry.store);

    // The commit-shaped document step finishStoreTileCommit performs.
    const mark = editor.markHistoryStep("paint brush stroke");
    let commitState: { node: Record<string, unknown>; offsetX: number } | null =
      null;

    editor.run(() => {
      editor.getState().updateNodeById("migrating-node", (node) => {
        if (node.type !== "image") {
          return node;
        }

        commitState = commitStoreTiles({
          assets: editor.rasterAssets as RasterAssetStore,
          commitRevision: 1,
          mergedBounds,
          node,
          store: entry.store,
          touchedTiles,
        });
        return commitState.node;
      });
    });
    expect(editor.commitHistoryStep(mark)).toBe(true);
    expect(commitState?.pure).toBe(false);

    editor.rasterHistory.record({
      anchorAfter: { x: entry.anchorX, y: entry.anchorY },
      capture,
      historyStepId: editor.history.lastPushedChangeId,
      nodeId: "migrating-node",
      strokeStore,
    });

    const migratedNode = editor.getNode("migrating-node");

    expect(migratedNode?.src).toBeUndefined();
    expect(isPureTiledImageNode(migratedNode, { anchorX: 0, anchorY: 0 })).toBe(
      true
    );

    // Undo: pre-migration node state (src back, manifest gone) and store
    // pixels restored surgically through the tile deltas.
    expect(editor.undo()).toBe(true);

    const undoneNode = editor.getNode("migrating-node");

    expect(undoneNode?.src).toBe(BASE_SRC);
    expect(undoneNode?.tileSources).toBeUndefined();
    expect(editor.getRasterStoreEntry("migrating-node")).toBe(entry);
    expect(findVisibleMismatch(preStrokeSnapshot, entry.store)).toBeNull();

    // Redo: the recorded node state brings the migrated manifest back and
    // the deterministic re-merge reproduces the store byte-for-byte, so the
    // manifest and store agree again.
    expect(editor.redo()).toBe(true);

    const redoneNode = editor.getNode("migrating-node");

    expect(redoneNode?.src).toBeUndefined();
    expect(redoneNode?.tileSources).toEqual(migratedNode?.tileSources);
    expect(findVisibleMismatch(postStrokeSnapshot, entry.store)).toBeNull();

    const hydrated = hydrateManifestIntoStore(
      redoneNode?.tileSources as RasterTileSource[],
      editor.rasterAssets as RasterAssetStore
    );

    expect(findVisibleMismatch(entry.store, hydrated)).toBeNull();
  });
});

const createPureTiledDocument = (tileBytes: Uint8Array[]) =>
  JSON.stringify({
    nodes: [
      {
        assetId: "asset-pure-tiled",
        height: 700,
        id: "pure-tiled",
        mimeType: "image/png",
        name: "Pure Tiled",
        opacity: 1,
        parentId: "root",
        tileSources: tileBytes.map((bytes, index) => ({
          col: index,
          height: 300,
          ref: `assets/raster/pure-tiled/tiles/${index + 1}_${index}_0.png`,
          row: 0,
          src: encodeDataUrl(bytes, "image/png"),
          width: 260,
          x: index * 512 + 20,
          y: 40,
        })),
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "image",
        visible: true,
        width: 1200,
      },
    ],
    version: PUNCH_DOCUMENT_VERSION,
  });

const createTileBytes = (seed: number) => {
  const bytes = new Uint8Array(64 * 1024);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = (index * seed + seed) % 256;
  }

  return bytes;
};

describe("pure-tiled persistence", () => {
  test("a pure-tiled (src-less) node round-trips through the punch package", () => {
    const editor = new Editor();
    const tileBytes = [createTileBytes(3), createTileBytes(7)];

    editor.loadDocument(createPureTiledDocument(tileBytes));

    const node = editor.nodes.find((candidate) => candidate.type === "image");

    expect(node?.src).toBeUndefined();
    expect(isPureTiledImageNode(node)).toBe(true);

    const packageBytes = createPunchPackage(editor.serializeDocument(), {
      getAssetBytes: (ref) => {
        const entry = editor.rasterAssets.get(ref);
        const bytes = editor.rasterAssets.getBytes(ref);

        return entry && bytes ? { bytes, mimeType: entry.mimeType } : null;
      },
    });
    const reloadedEditor = new Editor();

    reloadedEditor.loadDocument(loadPunchPackageContents(packageBytes));

    const reloadedNode = reloadedEditor.nodes.find(
      (candidate) => candidate.type === "image"
    );

    expect(reloadedNode?.src).toBeUndefined();
    expect(
      reloadedNode?.tileSources?.map((tileSource) => tileSource.ref)
    ).toEqual(node?.tileSources?.map((tileSource) => tileSource.ref));
    expect(
      reloadedNode?.tileSources?.map((tileSource) => ({
        height: tileSource.height,
        width: tileSource.width,
        x: tileSource.x,
        y: tileSource.y,
      }))
    ).toEqual(
      node?.tileSources?.map((tileSource) => ({
        height: tileSource.height,
        width: tileSource.width,
        x: tileSource.x,
        y: tileSource.y,
      }))
    );

    for (const [index, tileSource] of (
      reloadedNode?.tileSources || []
    ).entries()) {
      expect(reloadedEditor.rasterAssets.getBytes(tileSource.ref)).toEqual(
        tileBytes[index]
      );
    }
  });

  test("a fully-erased (zero-tile) node round-trips through the punch package", () => {
    const editor = new Editor();

    editor.loadDocument(
      JSON.stringify({
        nodes: [
          {
            assetId: "asset-erased",
            height: 300,
            id: "erased-node",
            mimeType: "image/png",
            name: "Erased",
            opacity: 1,
            parentId: "root",
            tileSources: [],
            transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 10, y: 20 },
            type: "image",
            visible: true,
            width: 400,
          },
        ],
        version: PUNCH_DOCUMENT_VERSION,
      })
    );

    const packageBytes = createPunchPackage(editor.serializeDocument(), {
      getAssetBytes: (ref) => {
        const entry = editor.rasterAssets.get(ref);
        const bytes = editor.rasterAssets.getBytes(ref);

        return entry && bytes ? { bytes, mimeType: entry.mimeType } : null;
      },
    });
    const reloadedEditor = new Editor();

    reloadedEditor.loadDocument(loadPunchPackageContents(packageBytes));

    const reloadedNode = reloadedEditor.nodes.find(
      (candidate) => candidate.type === "image"
    );

    expect(reloadedNode?.id).toBe("erased-node");
    expect(reloadedNode?.src).toBeUndefined();
    expect(reloadedNode?.tileSources).toHaveLength(0);
    expect(reloadedNode?.width).toBe(400);
    expect(reloadedNode?.height).toBe(300);
  });
});
