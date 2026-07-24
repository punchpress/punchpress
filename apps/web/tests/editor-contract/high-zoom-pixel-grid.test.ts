import { describe, expect, test } from "bun:test";
import {
  createDefaultArtboardNode,
  createDefaultImageNode,
  Editor,
  getPixelGridTarget,
  getRasterPresentationPolicy,
  PIXEL_GRID_ZOOM_THRESHOLD,
} from "@punchpress/engine";
import {
  getPixelGridPreviewNode,
  getPixelGridStrokeWidths,
} from "../../src/components/canvas/canvas-pixel-grid-math";

const createArtboard = () => ({
  ...createDefaultArtboardNode("Frame"),
  height: 600,
  id: "frame",
  transform: {
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    x: 200,
    y: 300,
  },
  width: 800,
});

const createRaster = (parentId = "root") => ({
  ...createDefaultImageNode({
    height: 64,
    src: "data:image/png;base64,pixel",
    width: 96,
  }),
  id: "raster",
  parentId,
  transform: {
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    x: 240,
    y: 340,
  },
});

describe("high-zoom Raster presentation", () => {
  test("switches from smooth sampling to exact samples above 500 percent", () => {
    expect(PIXEL_GRID_ZOOM_THRESHOLD).toBe(5);
    expect(getRasterPresentationPolicy(5)).toEqual({
      sampling: "smooth",
      showPixelGrid: false,
    });
    expect(getRasterPresentationPolicy(5.000_001)).toEqual({
      sampling: "exact",
      showPixelGrid: true,
    });
    expect(getRasterPresentationPolicy(128)).toEqual({
      sampling: "exact",
      showPixelGrid: true,
    });
  });

  test("keeps a Frame-owned grid anchored to the full Frame", () => {
    const editor = new Editor();
    const frame = createArtboard();
    const raster = createRaster(frame.id);

    editor.getState().loadNodes([frame, raster]);
    editor.select(raster.id);

    expect(getPixelGridTarget(editor)).toMatchObject({
      kind: "frame",
      node: {
        height: 600,
        id: "frame",
        width: 800,
      },
      sourceNodeId: "raster",
    });

    editor.getState().updateNodeById(raster.id, (node) => ({
      ...node,
      height: 220,
      transform: {
        ...node.transform,
        x: 120,
        y: 180,
      },
      width: 320,
    }));

    expect(getPixelGridTarget(editor)).toMatchObject({
      kind: "frame",
      node: {
        height: 600,
        id: "frame",
        width: 800,
      },
      sourceNodeId: "raster",
    });
  });

  test("uses the active standalone Raster and its transient Crop plane", () => {
    const editor = new Editor();
    const raster = createRaster();

    editor.getState().loadNodes([raster]);
    editor.select(raster.id);

    expect(getPixelGridTarget(editor)).toMatchObject({
      kind: "raster",
      node: {
        height: 64,
        id: "raster",
        width: 96,
      },
      sourceNodeId: "raster",
    });

    editor.getState().setRasterCropSession({
      nodeId: raster.id,
      rect: {
        height: 44,
        width: 72,
        x: -8,
        y: 12,
      },
    });

    const target = getPixelGridTarget(editor);

    expect(target).toMatchObject({
      kind: "raster",
      node: {
        baseX: 8,
        baseY: -12,
        height: 44,
        id: "raster",
        width: 72,
      },
      sourceNodeId: "raster",
    });
    expect(target?.node.transform.x).toBeCloseTo(232, 6);
    expect(target?.node.transform.y).toBeCloseTo(352, 6);
  });

  test("does not create a Workspace grid for non-finite active content", () => {
    const editor = new Editor();

    expect(getPixelGridTarget(editor)).toBeNull();
  });

  test("keeps the grid attached to move and resize previews", () => {
    const frame = createArtboard();
    const movedFrame = getPixelGridPreviewNode(frame, {
      delta: { x: 12.5, y: 8.25 },
      nodeIds: [frame.id],
    });

    expect(movedFrame.transform).toMatchObject({
      x: 212.5,
      y: 308.25,
    });

    const resizedFrame = getPixelGridPreviewNode(frame, {
      nodeIds: [frame.id],
      resize: {
        nodeUpdate: {
          height: 720,
          transform: { x: 180, y: 260 },
          width: 960,
        },
      },
    });

    expect(resizedFrame).toMatchObject({
      height: 720,
      transform: { x: 180, y: 260 },
      width: 960,
    });

    const raster = createRaster();
    const aggregateResizedRaster = getPixelGridPreviewNode(raster, {
      effectiveNodeIdSet: new Set([raster.id, "other-node"]),
      nodeIds: [raster.id, "other-node"],
      resize: {
        anchorCanvas: { x: 0, y: 0 },
        scale: 1.5,
      },
    });

    expect(aggregateResizedRaster.transform).toMatchObject({
      scaleX: 1.5,
      scaleY: 1.5,
      x: 384,
      y: 526,
    });

    expect(
      getPixelGridPreviewNode(frame, {
        effectiveNodeIdSet: new Set([raster.id, "other-node"]),
        nodeIds: [frame.id, "other-node"],
        resize: {
          anchorCanvas: { x: 0, y: 0 },
          scale: 1.5,
        },
      })
    ).toEqual(frame);
  });

  test("keeps physical grid strokes thin at fractional zoom and DPR", () => {
    expect(
      getPixelGridStrokeWidths({
        devicePixelRatio: 0.75,
        scaleX: 1.25,
        scaleY: 0.8,
        zoom: 7.25,
      })
    ).toEqual({
      horizontal: 1 / (0.75 * 7.25 * 0.8),
      vertical: 1 / (0.75 * 7.25 * 1.25),
    });
  });
});
