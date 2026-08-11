import { describe, expect, test } from "bun:test";
import {
  createDefaultImageNode,
  Editor,
  getPixelGridTarget,
  MAX_RASTER_CROP_AREA,
  MAX_RASTER_CROP_DIMENSION,
} from "@punchpress/engine";

describe("Raster resize", () => {
  test("locks the aspect ratio by default and exposes a public toggle", () => {
    const editor = new Editor();
    const node = {
      ...createDefaultImageNode({ height: 60, width: 80 }),
      id: "raster",
    };

    editor.getState().loadNodes([node]);

    expect(editor.isRasterAspectRatioLocked(node.id)).toBe(true);
    expect(editor.setRasterAspectRatioLocked(node.id, false)).toBe(true);
    expect(editor.isRasterAspectRatioLocked(node.id)).toBe(false);
    expect(editor.setRasterAspectRatioLocked("missing", false)).toBe(false);
  });

  test("publishes integer geometry and pixels as one asynchronous history step", async () => {
    let releaseResample = () => undefined;
    let pixels = "before";
    const resampleReady = new Promise<void>((resolve) => {
      releaseResample = resolve;
    });
    const rasterSurface = {
      resampleSurface: async (request) => {
        expect(request).toMatchObject({
          pixelSize: { height: 77, width: 121 },
          targetId: "raster",
        });
        await resampleReady;
        return {
          redo: () => {
            pixels = "after";
          },
          undo: () => {
            pixels = "before";
          },
        };
      },
      resolveSurface: () => null,
    };
    const editor = new Editor({ rasterSurface });
    const node = {
      ...createDefaultImageNode({ height: 60, width: 80 }),
      id: "raster",
    };

    editor.getState().loadNodes([node]);
    editor.setRasterAspectRatioLocked(node.id, false);
    const completion = editor.resizeRaster(node.id, {
      height: 76.6,
      width: 120.7,
    });

    expect(editor.getNode(node.id)).toMatchObject({ height: 60, width: 80 });
    expect(editor.getRasterResizeState(node.id)).toEqual({
      phase: "resampling",
      targetHeight: 77,
      targetWidth: 121,
    });

    releaseResample();
    expect(await completion).toBe(true);
    expect(editor.getNode(node.id)).toMatchObject({
      baseHeight: 77,
      baseWidth: 121,
      height: 77,
      pixelHeight: 77,
      pixelWidth: 121,
      width: 121,
    });
    expect(pixels).toBe("after");
    expect(editor.getRasterResizeState(node.id)).toBeNull();

    expect(editor.undo()).toBe(true);
    expect(editor.getNode(node.id)).toMatchObject({ height: 60, width: 80 });
    expect(pixels).toBe("before");
    expect(editor.undo()).toBe(false);

    expect(editor.redo()).toBe(true);
    expect(editor.getNode(node.id)).toMatchObject({ height: 77, width: 121 });
    expect(pixels).toBe("after");
  });

  test("rolls back geometry and interactivity when resampling fails", async () => {
    const rasterSurface = {
      resampleSurface: () =>
        Promise.reject(new Error("fixture resample failed")),
      resolveSurface: () => null,
    };
    const editor = new Editor({ rasterSurface });
    const node = {
      ...createDefaultImageNode({ height: 60, width: 80 }),
      id: "raster",
    };

    editor.getState().loadNodes([node]);

    expect(await editor.resizeRaster(node.id, { width: 120 })).toBe(false);
    expect(editor.getNode(node.id)).toMatchObject({
      height: 60,
      width: 80,
    });
    expect(editor.getRasterResizeState(node.id)).toBeNull();
    expect(editor.undo()).toBe(false);
  });

  test("treats an unchanged resize commit as a clean no-op", async () => {
    let resampleCount = 0;
    const editor = new Editor({
      rasterSurface: {
        resampleSurface: () => {
          resampleCount += 1;
          return Promise.resolve({
            redo: () => undefined,
            undo: () => undefined,
          });
        },
        resolveSurface: () => null,
      },
    });
    const node = {
      ...createDefaultImageNode({ height: 60, width: 80 }),
      id: "raster",
    };

    editor.getState().loadNodes([node]);
    const session = editor.beginRasterResize(node.id);

    expect(await editor.commitRasterResize(session)).toBe(false);
    expect(editor.selectionDragPreview).toBeNull();
    expect(resampleCount).toBe(0);
    expect(editor.undo()).toBe(false);
  });

  test("bounds resize allocation by the shared finite Raster limits", async () => {
    const requests: Array<{ pixelSize: { height: number; width: number } }> =
      [];
    const editor = new Editor({
      rasterSurface: {
        resampleSurface: (nextRequest) => {
          requests.push(nextRequest);
          return Promise.resolve({
            redo: () => undefined,
            undo: () => undefined,
          });
        },
        resolveSurface: () => null,
      },
    });
    const node = {
      ...createDefaultImageNode({ height: 60, width: 80 }),
      id: "raster",
    };

    editor.getState().loadNodes([node]);
    editor.setRasterAspectRatioLocked(node.id, false);

    expect(
      await editor.resizeRaster(node.id, {
        height: MAX_RASTER_CROP_DIMENSION,
        width: MAX_RASTER_CROP_DIMENSION,
      })
    ).toBe(true);
    expect(requests[0]?.pixelSize.width).toBeLessThanOrEqual(
      MAX_RASTER_CROP_DIMENSION
    );
    expect(requests[0]?.pixelSize.height).toBeLessThanOrEqual(
      MAX_RASTER_CROP_DIMENSION
    );
    expect(
      (requests[0]?.pixelSize.width ?? 0) * (requests[0]?.pixelSize.height ?? 0)
    ).toBeLessThanOrEqual(MAX_RASTER_CROP_AREA);
  });

  test("keeps proportional allocation rounding below the area ceiling", async () => {
    const requests: Array<{ pixelSize: { height: number; width: number } }> =
      [];
    const editor = new Editor({
      rasterSurface: {
        resampleSurface: (request) => {
          requests.push(request);
          return Promise.resolve({
            redo: () => undefined,
            undo: () => undefined,
          });
        },
        resolveSurface: () => null,
      },
    });
    const node = {
      ...createDefaultImageNode({ height: 1589, width: 2352 }),
      id: "raster",
      pixelHeight: 1543,
      pixelWidth: 3830,
    };

    editor.getState().loadNodes([node]);
    editor.setRasterAspectRatioLocked(node.id, false);
    await editor.resizeRaster(node.id, { height: 13_318, width: 11_535 });

    expect(
      (requests[0]?.pixelSize.width ?? 0) * (requests[0]?.pixelSize.height ?? 0)
    ).toBeLessThanOrEqual(MAX_RASTER_CROP_AREA);
  });

  test("keeps handle resize transient until one post-gesture resample", async () => {
    const requests: unknown[] = [];
    const editor = new Editor({
      rasterSurface: {
        resampleSurface: (request) => {
          requests.push(request);
          return Promise.resolve({
            redo: () => undefined,
            undo: () => undefined,
          });
        },
        resolveSurface: () => null,
      },
    });
    const node = {
      ...createDefaultImageNode({ height: 60, width: 80 }),
      id: "raster",
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 100,
        y: 100,
      },
    };

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    const frame = editor.getNodeTransformFrame(node.id);
    const session = editor.beginResizeSelection({
      anchorCanvas: {
        x: frame?.bounds.minX ?? 0,
        y: frame?.bounds.minY ?? 0,
      },
      direction: [1, 1],
      nodeId: node.id,
    });

    expect(editor.updateResizeSelection(session, { scale: 1.5 })).toEqual([
      node.id,
    ]);
    expect(editor.getNode(node.id)).toMatchObject({ height: 60, width: 80 });
    expect(
      editor.selectionDragPreview?.resize?.transformFrame.bounds
    ).toMatchObject({
      height: 90,
      width: 120,
    });

    expect(await editor.commitResizeSelection(session)).toEqual([node.id]);
    expect(requests).toHaveLength(1);
    expect(editor.getNode(node.id)).toMatchObject({
      height: 90,
      pixelHeight: 90,
      pixelWidth: 120,
      width: 120,
    });
  });

  test("hides the active Raster pixel grid for preview and resampling", async () => {
    let releaseResample = () => undefined;
    const resampleReady = new Promise<void>((resolve) => {
      releaseResample = resolve;
    });
    const editor = new Editor({
      rasterSurface: {
        resampleSurface: async () => {
          await resampleReady;
          return { redo: () => undefined, undo: () => undefined };
        },
        resolveSurface: () => null,
      },
    });
    const node = {
      ...createDefaultImageNode({ height: 60, width: 80 }),
      id: "raster",
    };

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    const frame = editor.getNodeTransformFrame(node.id);
    const session = editor.beginResizeSelection({
      anchorCanvas: {
        x: frame?.bounds.minX ?? 0,
        y: frame?.bounds.minY ?? 0,
      },
      direction: [1, 1],
      nodeId: node.id,
    });

    expect(getPixelGridTarget(editor)?.sourceNodeId).toBe(node.id);
    editor.updateResizeSelection(session, { scale: 1.5 });
    expect(getPixelGridTarget(editor)).toBeNull();

    const completion = editor.commitResizeSelection(session);
    expect(getPixelGridTarget(editor)).toBeNull();
    releaseResample();
    await completion;
    expect(getPixelGridTarget(editor)?.sourceNodeId).toBe(node.id);
  });

  test("allows unlocked handles to resize Raster axes independently", async () => {
    const editor = new Editor({
      rasterSurface: {
        resampleSurface: async () => ({
          redo: () => undefined,
          undo: () => undefined,
        }),
        resolveSurface: () => null,
      },
    });
    const node = {
      ...createDefaultImageNode({ height: 60, width: 80 }),
      id: "raster",
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 100,
        y: 100,
      },
    };

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.setRasterAspectRatioLocked(node.id, false);
    const frame = editor.getNodeTransformFrame(node.id);
    const session = editor.beginResizeSelection({
      anchorCanvas: {
        x: frame?.bounds.minX ?? 0,
        y: (frame?.bounds.minY ?? 0) + (frame?.bounds.height ?? 0) / 2,
      },
      handle: "e",
      nodeId: node.id,
    });

    expect(session).not.toBeNull();
    editor.updateResizeSelection(session, {
      pointCanvas: {
        x: (frame?.bounds.maxX ?? 0) + 40,
        y: (frame?.bounds.minY ?? 0) + (frame?.bounds.height ?? 0) / 2,
      },
      preview: true,
    });
    expect(
      editor.selectionDragPreview?.resize?.transformFrame.bounds
    ).toMatchObject({
      height: 60,
      width: 120,
    });

    expect(await editor.commitResizeSelection(session)).toEqual([node.id]);
    expect(editor.getNode(node.id)).toMatchObject({ height: 60, width: 120 });
  });

  test("temporarily preserves Raster aspect ratio while Shift-resizing an unlocked corner", async () => {
    const editor = new Editor({
      rasterSurface: {
        resampleSurface: async () => ({
          redo: () => undefined,
          undo: () => undefined,
        }),
        resolveSurface: () => null,
      },
    });
    const node = {
      ...createDefaultImageNode({ height: 60, width: 80 }),
      id: "raster",
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 100,
        y: 100,
      },
    };

    editor.getState().loadNodes([node]);
    editor.select(node.id);
    editor.setRasterAspectRatioLocked(node.id, false);
    const frame = editor.getNodeTransformFrame(node.id);
    const session = editor.beginResizeSelection({
      anchorCanvas: {
        x: frame?.bounds.minX ?? 0,
        y: frame?.bounds.minY ?? 0,
      },
      handle: "se",
      nodeId: node.id,
    });

    expect(session).not.toBeNull();
    editor.updateResizeSelection(session, {
      pointCanvas: {
        x: (frame?.bounds.maxX ?? 0) + 40,
        y: (frame?.bounds.maxY ?? 0) + 10,
      },
      preserveAspectRatio: true,
      preview: true,
    });
    expect(
      editor.selectionDragPreview?.resize?.transformFrame.bounds
    ).toMatchObject({
      height: 90,
      width: 120,
    });

    expect(await editor.commitResizeSelection(session)).toEqual([node.id]);
    expect(editor.getNode(node.id)).toMatchObject({ height: 90, width: 120 });
  });

  test("supersedes an in-flight resize without publishing stale geometry", async () => {
    const releases: Array<() => void> = [];
    const cancelled: string[] = [];
    const editor = new Editor({
      rasterSurface: {
        cancelResample: (nodeId) => cancelled.push(nodeId),
        resampleSurface: async () => {
          await new Promise<void>((resolve) => releases.push(resolve));
          return { redo: () => undefined, undo: () => undefined };
        },
        resolveSurface: () => null,
      },
    });
    const node = {
      ...createDefaultImageNode({ height: 60, width: 80 }),
      id: "raster",
    };

    editor.getState().loadNodes([node]);
    const first = editor.resizeRaster(node.id, { width: 120 });
    const second = editor.resizeRaster(node.id, { width: 100 });

    expect(cancelled).toEqual([node.id]);
    releases[0]?.();
    releases[1]?.();
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(editor.getNode(node.id)).toMatchObject({ height: 75, width: 100 });
    expect(editor.undo()).toBe(true);
    expect(editor.getNode(node.id)).toMatchObject({ height: 60, width: 80 });
    expect(editor.undo()).toBe(false);
  });
});
