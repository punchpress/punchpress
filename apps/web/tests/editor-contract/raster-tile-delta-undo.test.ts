import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";
import { PUNCH_DOCUMENT_VERSION } from "@punchpress/punch-schema";
import { setPerfSink } from "../../../../packages/engine/src/perf/perf-hooks";
import {
  captureTileDeltasBeforeMerge,
  createStrokeCapture,
  RASTER_HISTORY_DEPTH,
  RasterHistoryManager,
  type RasterStrokeCapture,
} from "../../../../packages/engine/src/raster/raster-history";
import type { RasterStoreEntry } from "../../../../packages/engine/src/raster/raster-store-manager";
import {
  commitMergedStrokeBounds,
  mergeStrokeStoreTile,
  RASTER_STORE_TILE_SIZE,
  RasterTileStore,
} from "../../../../packages/engine/src/raster/raster-tile-store";

const TILE = RASTER_STORE_TILE_SIZE;

interface Point {
  x: number;
  y: number;
}

/** Circle-envelope dabs along a polyline — enough brush realism for deltas. */
const paintStroke = (
  store: RasterTileStore,
  polyline: Point[],
  size: number,
  color = { b: 40, g: 90, r: 200 }
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
      opacity: 1,
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

/** Full physical-buffer snapshot (gutters included) of every tile. */
const snapshotStore = (store: RasterTileStore) => {
  const tiles = new Map<string, Uint8ClampedArray>();

  for (const [key, tile] of store.tiles) {
    tiles.set(key, new Uint8ClampedArray(tile.pixels));
  }

  return tiles;
};

/**
 * First byte difference between a snapshot and the store, comparing every
 * physical pixel of every tile on either side; a tile present on one side
 * only must be fully transparent.
 */
const findSnapshotMismatch = (
  snapshot: Map<string, Uint8ClampedArray>,
  store: RasterTileStore
) => {
  const keys = new Set([...snapshot.keys(), ...store.tiles.keys()]);

  for (const key of keys) {
    const expected = snapshot.get(key);
    const actual = store.tiles.get(key)?.pixels;
    const length = expected?.length ?? actual?.length ?? 0;

    for (let offset = 0; offset < length; offset += 1) {
      const expectedByte = expected?.[offset] ?? 0;
      const actualByte = actual?.[offset] ?? 0;

      if (expectedByte !== actualByte) {
        return { actualByte, expectedByte, offset, tile: key };
      }
    }
  }

  return null;
};

/**
 * Capture-then-merge exactly as BrushStrokeSession.mergeStrokeStoreBudgeted
 * runs it: per stroke tile, copy the about-to-be-written target sub-rects,
 * then merge.
 */
const mergeWithCapture = (
  store: RasterTileStore,
  strokeStore: RasterTileStore,
  { anchorX = 0, anchorY = 0, mode = "paint" as "erase" | "paint" } = {}
) => {
  const capture = createStrokeCapture({
    anchorBefore: { x: anchorX, y: anchorY },
    mergeAnchorX: anchorX,
    mergeAnchorY: anchorY,
    operation: mode,
  });
  const strokeBounds = strokeStore.getPaintedBounds();

  if (!strokeBounds) {
    return capture;
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
    mergeStrokeStoreTile({ anchorX, anchorY, mode, store, strokeTile });
    strokeTile.merged = true;
  }

  strokeStore.revision += 1;
  commitMergedStrokeBounds({ anchorX, anchorY, store, strokeBounds });
  return capture;
};

const createEntry = (store = new RasterTileStore()): RasterStoreEntry => ({
  anchorX: 0,
  anchorY: 0,
  commitQueue: Promise.resolve(),
  hydrated: true,
  hydrating: null,
  pendingCommits: 0,
  pyramid: null,
  store,
});

const recordStep = (
  manager: RasterHistoryManager,
  {
    anchorAfter = { x: 0, y: 0 },
    capture,
    historyStepId,
    nodeId = "raster-node",
    strokeStore,
  }: {
    anchorAfter?: Point;
    capture: RasterStrokeCapture;
    historyStepId: number;
    nodeId?: string;
    strokeStore: RasterTileStore;
  }
) => {
  manager.record({ anchorAfter, capture, historyStepId, nodeId, strokeStore });
  return manager.get(historyStepId);
};

const BASE_STROKE: Point[] = [
  { x: 200, y: 200 },
  { x: 900, y: 260 },
];
const CROSSING_STROKE: Point[] = [
  { x: 380, y: 120 },
  { x: TILE, y: 300 },
  { x: 700, y: 640 },
];

describe("tile-delta capture and round-trip", () => {
  test("undo restores pre-stroke bytes at every physical pixel, gutters included", () => {
    const store = new RasterTileStore();

    paintStroke(store, BASE_STROKE, 160);

    const beforeSnapshot = snapshotStore(store);
    const strokeStore = new RasterTileStore();

    paintStroke(strokeStore, CROSSING_STROKE, 180, { b: 10, g: 200, r: 20 });

    const capture = mergeWithCapture(store, strokeStore);
    const afterSnapshot = snapshotStore(store);

    expect(findSnapshotMismatch(beforeSnapshot, store)).not.toBeNull();

    const manager = new RasterHistoryManager();
    const entry = createEntry(store);
    const step = recordStep(manager, {
      capture,
      historyStepId: 1,
      strokeStore,
    });

    manager.applyUndo(step, entry);
    expect(findSnapshotMismatch(beforeSnapshot, store)).toBeNull();

    manager.applyRedo(step, entry);
    expect(findSnapshotMismatch(afterSnapshot, store)).toBeNull();

    // A second undo reuses the same deltas and must stay byte-exact.
    manager.applyUndo(step, entry);
    expect(findSnapshotMismatch(beforeSnapshot, store)).toBeNull();
  });

  test("undo and redo invalidate the restored tiles for the display cache and pyramid", () => {
    const store = new RasterTileStore();

    paintStroke(store, BASE_STROKE, 160);

    const strokeStore = new RasterTileStore();

    paintStroke(strokeStore, CROSSING_STROKE, 180);

    const capture = mergeWithCapture(store, strokeStore);
    const manager = new RasterHistoryManager();
    const entry = createEntry(store);
    const step = recordStep(manager, {
      capture,
      historyStepId: 1,
      strokeStore,
    });

    // Drain invalidation state as the compositor/pyramid do each frame.
    store.consumeDirtyBounds();
    store.takeDirtyLevelCoords(1);

    const revisionBefore = store.revision;
    const touchedTileRevisions = new Map(
      capture.tiles.map((delta) => [
        `${delta.col}:${delta.row}`,
        store.getTile(delta.col, delta.row)?.revision ?? null,
      ])
    );

    manager.applyUndo(step, entry);

    expect(store.revision).toBeGreaterThan(revisionBefore);
    expect(store.consumeDirtyBounds()).not.toBeNull();
    expect(store.takeDirtyLevelCoords(1)).not.toBeNull();

    for (const delta of capture.tiles) {
      const key = `${delta.col}:${delta.row}`;
      const tile = store.getTile(delta.col, delta.row);

      if (!tile) {
        continue;
      }

      expect(tile.revision).not.toBe(touchedTileRevisions.get(key));
      expect(tile.syncRect).not.toBeNull();
    }
  });

  test("multi-stroke undo chains restore each intermediate state in order", () => {
    const store = new RasterTileStore();
    const manager = new RasterHistoryManager();
    const entry = createEntry(store);
    const strokes: Point[][] = [
      BASE_STROKE,
      CROSSING_STROKE,
      [
        { x: 640, y: 200 },
        { x: 660, y: 620 },
      ],
    ];
    const snapshots = [snapshotStore(store)];
    const steps = strokes.map((polyline, index) => {
      const strokeStore = new RasterTileStore();

      paintStroke(strokeStore, polyline, 140, {
        b: 20 * index,
        g: 60 + 50 * index,
        r: 220 - 70 * index,
      });

      const capture = mergeWithCapture(store, strokeStore);

      snapshots.push(snapshotStore(store));
      return recordStep(manager, {
        capture,
        historyStepId: index + 1,
        strokeStore,
      });
    });

    for (let index = steps.length - 1; index >= 0; index -= 1) {
      manager.applyUndo(steps[index], entry);
      expect(findSnapshotMismatch(snapshots[index], store)).toBeNull();
    }

    for (let index = 0; index < steps.length; index += 1) {
      manager.applyRedo(steps[index], entry);
      expect(findSnapshotMismatch(snapshots[index + 1], store)).toBeNull();
    }
  });

  test("erase strokes round-trip alpha through undo and redo", () => {
    const store = new RasterTileStore();

    paintStroke(store, BASE_STROKE, 200);

    const beforeSnapshot = snapshotStore(store);
    const strokeStore = new RasterTileStore();

    paintStroke(
      strokeStore,
      [
        { x: 420, y: 180 },
        { x: 460, y: 320 },
      ],
      120
    );

    const capture = mergeWithCapture(store, strokeStore, { mode: "erase" });
    const afterSnapshot = snapshotStore(store);
    const manager = new RasterHistoryManager();
    const entry = createEntry(store);
    const step = recordStep(manager, {
      capture,
      historyStepId: 1,
      strokeStore,
    });

    expect(store.getPixelAt(440, 240)[3]).toBe(0);

    manager.applyUndo(step, entry);
    expect(findSnapshotMismatch(beforeSnapshot, store)).toBeNull();
    expect(store.getPixelAt(440, 240)[3]).toBe(255);

    manager.applyRedo(step, entry);
    expect(findSnapshotMismatch(afterSnapshot, store)).toBeNull();
  });

  test("a rebasing commit restores the prior anchor on undo", () => {
    const store = new RasterTileStore();
    const strokeStore = new RasterTileStore();

    // Stroke crossing the left/top edge: merge anchors stay pre-rebase, the
    // commit then shifts the entry anchor like finishTileSurfaceCommit does.
    paintStroke(
      strokeStore,
      [
        { x: -60, y: -40 },
        { x: 120, y: 90 },
      ],
      100
    );

    const entry = createEntry(store);
    const capture = mergeWithCapture(store, strokeStore);

    entry.anchorX = 61;
    entry.anchorY = 41;

    const manager = new RasterHistoryManager();
    const step = recordStep(manager, {
      anchorAfter: { x: 61, y: 41 },
      capture,
      historyStepId: 1,
      strokeStore,
    });
    const afterSnapshot = snapshotStore(store);

    manager.applyUndo(step, entry);
    expect(entry.anchorX).toBe(0);
    expect(entry.anchorY).toBe(0);
    expect(findSnapshotMismatch(new Map(), store)).toBeNull();

    manager.applyRedo(step, entry);
    expect(entry.anchorX).toBe(61);
    expect(entry.anchorY).toBe(41);
    expect(findSnapshotMismatch(afterSnapshot, store)).toBeNull();
  });

  test("depth cap evicts oldest deltas and returns their bytes", () => {
    const counters = new Map<string, number>();

    setPerfSink({
      incrementCounter: (name, amount = 1) => {
        counters.set(name, (counters.get(name) || 0) + amount);
      },
      recordDuration: () => {
        // Counters only; durations are irrelevant to this test.
      },
    });

    try {
      const store = new RasterTileStore();
      const manager = new RasterHistoryManager();

      paintStroke(store, BASE_STROKE, 160);

      const stepIds: number[] = [];

      for (let index = 0; index < RASTER_HISTORY_DEPTH + 3; index += 1) {
        const strokeStore = new RasterTileStore();

        paintStroke(
          strokeStore,
          [
            { x: 220 + index * 8, y: 210 },
            { x: 260 + index * 8, y: 230 },
          ],
          24
        );

        const capture = mergeWithCapture(store, strokeStore);
        const historyStepId = index + 1;

        recordStep(manager, { capture, historyStepId, strokeStore });
        stepIds.push(historyStepId);
      }

      expect(manager.steps.size).toBe(RASTER_HISTORY_DEPTH);
      expect(manager.get(stepIds[0])).toBeNull();
      expect(manager.get(stepIds[2])).toBeNull();
      expect(manager.get(stepIds[3])).not.toBeNull();
      expect(counters.get("raster.history.evict")).toBe(3);
      expect(counters.get("raster.history.bytes")).toBeGreaterThan(0);

      manager.clear();
      expect(counters.get("raster.history.bytes")).toBe(0);
    } finally {
      setPerfSink(null);
    }
  });
});

const createImageDocument = (nodeIds: string[]) =>
  JSON.stringify({
    nodes: nodeIds.map((id, index) => ({
      height: 512,
      id,
      mimeType: "image/png",
      name: id,
      opacity: 1,
      parentId: "root",
      src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/lhL1WQAAAABJRU5ErkJggg==",
      transform: { rotation: 0, scaleX: 1, scaleY: 1, x: index * 600, y: 0 },
      type: "image",
      visible: true,
      width: 512,
    })),
    version: PUNCH_DOCUMENT_VERSION,
  });

/**
 * Commit-shaped document step mirroring finishTileSurfaceCommit: append a
 * src-less manifest entry inside a history mark, commit, and return the
 * pushed step id.
 */
const commitManifestStep = (editor: Editor, nodeId: string, ref: string) => {
  const mark = editor.markHistoryStep("paint brush stroke");

  editor.run(() => {
    editor.getState().updateNodeById(nodeId, (node) => ({
      ...node,
      tileSources: [
        ...(node.tileSources || []),
        { col: 0, height: 64, ref, row: 0, width: 64, x: 8, y: 8 },
      ],
    }));
  });
  if (!editor.commitHistoryStep(mark)) {
    throw new Error("Expected the manifest step to commit");
  }

  return editor.history.lastPushedChangeId as number;
};

describe("editor undo/redo raster reconciliation", () => {
  test("a step with a delta keeps the store entry and restores pixels surgically", () => {
    const editor = new Editor();

    editor.loadDocument(createImageDocument(["painted-node"]));

    const entry = editor.rasterStores.getOrCreateEntry("painted-node");

    entry.hydrated = true;
    paintStroke(entry.store, BASE_STROKE, 160);

    const beforeSnapshot = snapshotStore(entry.store);
    const strokeStore = new RasterTileStore();

    paintStroke(strokeStore, CROSSING_STROKE, 180);

    const capture = mergeWithCapture(entry.store, strokeStore);
    const afterSnapshot = snapshotStore(entry.store);
    const historyStepId = commitManifestStep(
      editor,
      "painted-node",
      "assets/raster/painted-node/tiles/1_0_0.png"
    );

    editor.rasterHistory.record({
      anchorAfter: { x: entry.anchorX, y: entry.anchorY },
      capture,
      historyStepId,
      nodeId: "painted-node",
      strokeStore,
    });

    expect(editor.undo()).toBe(true);
    expect(editor.getRasterStoreEntry("painted-node")).toBe(entry);
    expect(findSnapshotMismatch(beforeSnapshot, entry.store)).toBeNull();
    expect(editor.getNode("painted-node")?.tileSources).toBeUndefined();

    expect(editor.redo()).toBe(true);
    expect(editor.getRasterStoreEntry("painted-node")).toBe(entry);
    expect(findSnapshotMismatch(afterSnapshot, entry.store)).toBeNull();
    expect(editor.getNode("painted-node")?.tileSources).toHaveLength(1);
  });

  test("a raster step without a delta releases only the affected node's entry", () => {
    const editor = new Editor();

    editor.loadDocument(createImageDocument(["changed-node", "other-node"]));

    const changedEntry = editor.rasterStores.getOrCreateEntry("changed-node");
    const otherEntry = editor.rasterStores.getOrCreateEntry("other-node");

    changedEntry.hydrated = true;
    otherEntry.hydrated = true;

    commitManifestStep(
      editor,
      "changed-node",
      "assets/raster/changed-node/tiles/1_0_0.png"
    );

    // No rasterHistory.record: the depth-cap/eviction fallback path.
    expect(editor.undo()).toBe(true);
    expect(editor.getRasterStoreEntry("changed-node")).toBeNull();
    expect(editor.getRasterStoreEntry("other-node")).toBe(otherEntry);

    expect(editor.redo()).toBe(true);
    expect(editor.getRasterStoreEntry("changed-node")).toBeNull();
    expect(editor.getRasterStoreEntry("other-node")).toBe(otherEntry);
  });

  test("undo past an evicted delta falls back to releasing the entry without crashing", () => {
    const editor = new Editor();

    editor.loadDocument(createImageDocument(["painted-node"]));

    const entry = editor.rasterStores.getOrCreateEntry("painted-node");

    entry.hydrated = true;

    const strokeStore = new RasterTileStore();

    paintStroke(strokeStore, BASE_STROKE, 80);

    const capture = mergeWithCapture(entry.store, strokeStore);
    const historyStepId = commitManifestStep(
      editor,
      "painted-node",
      "assets/raster/painted-node/tiles/1_0_0.png"
    );

    editor.rasterHistory.record({
      anchorAfter: { x: 0, y: 0 },
      capture,
      historyStepId,
      nodeId: "painted-node",
      strokeStore,
    });
    editor.rasterHistory.evict(historyStepId);

    expect(editor.undo()).toBe(true);
    expect(editor.getRasterStoreEntry("painted-node")).toBeNull();
  });

  test("non-raster steps leave store entries alone", () => {
    const editor = new Editor();

    editor.loadDocument(createImageDocument(["painted-node"]));

    const entry = editor.rasterStores.getOrCreateEntry("painted-node");

    entry.hydrated = true;

    const mark = editor.markHistoryStep("move node");

    editor.run(() => {
      editor.getState().updateNodeById("painted-node", (node) => ({
        ...node,
        transform: { ...node.transform, x: node.transform.x + 40 },
      }));
    });
    expect(editor.commitHistoryStep(mark)).toBe(true);

    expect(editor.undo()).toBe(true);
    expect(editor.getRasterStoreEntry("painted-node")).toBe(entry);

    expect(editor.redo()).toBe(true);
    expect(editor.getRasterStoreEntry("painted-node")).toBe(entry);
  });

  test("branch divergence never resurrects a stale delta", () => {
    const editor = new Editor();

    editor.loadDocument(createImageDocument(["painted-node"]));

    const entry = editor.rasterStores.getOrCreateEntry("painted-node");

    entry.hydrated = true;
    paintStroke(entry.store, BASE_STROKE, 120);

    const strokeStore = new RasterTileStore();

    paintStroke(strokeStore, CROSSING_STROKE, 140);

    const capture = mergeWithCapture(entry.store, strokeStore);
    const strokeStepId = commitManifestStep(
      editor,
      "painted-node",
      "assets/raster/painted-node/tiles/1_0_0.png"
    );

    editor.rasterHistory.record({
      anchorAfter: { x: 0, y: 0 },
      capture,
      historyStepId: strokeStepId,
      nodeId: "painted-node",
      strokeStore,
    });

    expect(editor.undo()).toBe(true);

    // Diverge: a new commit clears the redo stack. Its step id must differ
    // from the stale stroke's, so undoing it can never apply those deltas.
    const divergentStepId = commitManifestStep(
      editor,
      "painted-node",
      "assets/raster/painted-node/tiles/2_0_0.png"
    );

    expect(divergentStepId).not.toBe(strokeStepId);
    expect(editor.rasterHistory.get(divergentStepId)).toBeNull();

    expect(editor.undo()).toBe(true);
    expect(editor.getRasterStoreEntry("painted-node")).toBeNull();
  });

  test("loading a document clears retained raster deltas", () => {
    const editor = new Editor();

    editor.loadDocument(createImageDocument(["painted-node"]));

    const entry = editor.rasterStores.getOrCreateEntry("painted-node");

    entry.hydrated = true;

    const strokeStore = new RasterTileStore();

    paintStroke(strokeStore, BASE_STROKE, 60);

    const capture = mergeWithCapture(entry.store, strokeStore);

    editor.rasterHistory.record({
      anchorAfter: { x: 0, y: 0 },
      capture,
      historyStepId: 7,
      nodeId: "painted-node",
      strokeStore,
    });
    expect(editor.rasterHistory.steps.size).toBe(1);

    editor.loadDocument(createImageDocument(["painted-node"]));
    expect(editor.rasterHistory.steps.size).toBe(0);
  });
});
