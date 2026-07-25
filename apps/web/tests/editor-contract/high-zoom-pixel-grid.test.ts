import { describe, expect, test } from "bun:test";
import {
  createDefaultArtboardNode,
  createDefaultImageNode,
  Editor,
  getPixelGridTarget,
  getRasterPixelFootprint,
  getRasterSampling,
  PIXEL_GRID_SCREEN_PIXEL_THRESHOLD,
  RASTER_MAGNIFIED_SCREEN_PIXEL_THRESHOLD,
  shouldShowPixelGrid,
  shouldUseFullResolutionRasterSource,
} from "@punchpress/engine";
import {
  getPixelGridPlane,
  getPixelGridPreviewNode,
  getPixelGridStrokeWidths,
} from "../../src/components/canvas/canvas-pixel-grid-math";
import {
  getRasterPresentationNode,
  getRasterRenderScale,
} from "../../src/components/canvas/raster/canvas-raster-presentation";

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
  test("decouples source sampling and full-resolution selection from the grid threshold", () => {
    expect(PIXEL_GRID_SCREEN_PIXEL_THRESHOLD).toBe(5);
    expect(RASTER_MAGNIFIED_SCREEN_PIXEL_THRESHOLD).toBe(2);

    const transformedFootprint = getRasterPixelFootprint({
      displayedHeight: 3.6,
      displayedWidth: 7.4,
      sampleHeight: 4,
      sampleWidth: 7,
      scaleX: 1.25,
      scaleY: 0.8,
      zoom: 4,
    });
    const minifiedAxisFootprint = getRasterPixelFootprint({
      displayedHeight: 3.6,
      displayedWidth: 7.4,
      sampleHeight: 4,
      sampleWidth: 7,
      scaleX: 1.25,
      scaleY: 0.2,
      zoom: 7,
    });
    const framePixelAtThreshold = getRasterPixelFootprint({
      displayedHeight: 1,
      displayedWidth: 1,
      sampleHeight: 1,
      sampleWidth: 1,
      scaleX: 1,
      scaleY: 1,
      zoom: 5,
    });

    expect(transformedFootprint.width).toBeCloseTo(5.285_714, 5);
    expect(transformedFootprint.height).toBeCloseTo(2.88, 5);
    expect(getRasterSampling(transformedFootprint)).toBe("exact");
    expect(shouldUseFullResolutionRasterSource(transformedFootprint)).toBe(
      true
    );
    expect(shouldShowPixelGrid(transformedFootprint)).toBe(false);
    expect(getRasterSampling(minifiedAxisFootprint)).toBe("smooth");
    expect(getRasterSampling(framePixelAtThreshold)).toBe("exact");
    expect(shouldUseFullResolutionRasterSource(framePixelAtThreshold)).toBe(
      true
    );
    expect(shouldShowPixelGrid(framePixelAtThreshold)).toBe(false);
    expect(
      shouldShowPixelGrid({
        height: framePixelAtThreshold.height + 0.000_001,
        width: framePixelAtThreshold.width + 0.000_001,
      })
    ).toBe(true);
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

  test("uses ancestor and transient resize transforms for Raster presentation", () => {
    const editor = new Editor();
    const group = {
      id: "group",
      name: "Scaled group",
      parentId: "root",
      transform: {
        rotation: 90,
        scaleX: 4,
        scaleY: 2,
        x: 0,
        y: 0,
      },
      type: "group" as const,
      visible: true,
    };
    const raster = {
      ...createRaster(group.id),
      transform: {
        rotation: 0,
        scaleX: 1.25,
        scaleY: 0.8,
        x: 0,
        y: 0,
      },
    };

    editor.getState().loadNodes([group, raster]);

    expect(getRasterRenderScale(editor, raster.id)).toEqual({
      x: 1.25,
      y: 0.8,
    });
    expect(getRasterRenderScale(editor, raster.id, group.id)).toEqual({
      x: 5,
      y: 1.6,
    });

    editor.setSelectionDragPreview({
      nodeIds: [raster.id],
      resize: {
        nodeUpdate: {
          transform: {
            scaleX: 2.5,
            scaleY: 1.6,
          },
        },
      },
    });

    expect(
      getRasterPresentationNode(editor, raster.id)?.transform
    ).toMatchObject({
      scaleX: 2.5,
      scaleY: 1.6,
    });
    expect(getRasterRenderScale(editor, raster.id)).toEqual({
      x: 2.5,
      y: 1.6,
    });

    editor.setSelectionDragPreview({
      effectiveNodeIdSet: new Set([raster.id]),
      nodeIds: [group.id],
      resize: {
        anchorCanvas: { x: 0, y: 0 },
        scale: 3,
      },
    });

    const aggregatePreviewScale = getRasterRenderScale(
      editor,
      raster.id,
      group.id
    );

    expect(aggregatePreviewScale.x).toBeCloseTo(15, 6);
    expect(aggregatePreviewScale.y).toBeCloseTo(4.8, 6);
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

  test("maps fractional Raster layout bounds to exact integer samples", () => {
    expect(
      getPixelGridPlane(
        {
          baseHeight: 3.6,
          baseWidth: 7.4,
          baseX: 0.4,
          baseY: -0.45,
        },
        {
          height: 4,
          width: 7,
        }
      )
    ).toEqual({
      cellHeight: 0.9,
      cellWidth: 7.4 / 7,
      originX: 0.4,
      originY: -0.45,
    });
  });
});
