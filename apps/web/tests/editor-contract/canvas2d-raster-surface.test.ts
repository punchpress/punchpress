import { describe, expect, test } from "bun:test";
import {
  createDefaultArtboardNode,
  createDefaultImageNode,
  createRasterOperationRecorder,
  createRasterStroke,
  Editor,
  RASTER_BRUSH_PRESETS,
  type RasterStrokeContext,
  type RasterStrokeSettings,
  type RasterTarget,
} from "@punchpress/engine";
import { createCanvas2dBrushTipCache } from "../../src/platform/raster/brush-tip-cache";
import { createCanvas2dRasterRuntime } from "../../src/platform/raster/canvas2d-raster-runtime";

const settings: RasterStrokeSettings = {
  angle: 0,
  angleJitter: 0,
  color: "#3366FF",
  flow: 1,
  hardness: 1,
  opacity: 0.75,
  roundness: 1,
  scatter: 0,
  seed: 1,
  size: 20,
  sizeJitter: 0,
  smoothing: 0,
  spacing: 0,
  tip: { kind: "round" },
};

const target: RasterTarget = {
  bounds: { height: 100, width: 100, x: 0, y: 0 },
  id: "existing-raster",
  pixelSize: { height: 200, width: 200 },
};

describe("Canvas2D Raster surface", () => {
  test("invalidates a stale presentation while decoding a replacement", async () => {
    const browser = createFakeCanvasBrowser();
    const runtime = createCanvas2dRasterRuntime(browser.capabilities);

    await runtime.ensureSurface({
      height: target.pixelSize.height,
      id: target.id,
      src: "data:image/png;base64,first",
      width: target.pixelSize.width,
    });

    let finishDecode: ((image: CanvasImageSource) => void) | null = null;

    browser.capabilities.decodeImage = () =>
      new Promise((resolve) => {
        finishDecode = resolve;
      });

    const replacement = runtime.ensureSurface({
      height: target.pixelSize.height,
      id: target.id,
      src: "data:image/png;base64,replacement",
      width: target.pixelSize.width,
    });

    expect(runtime.getPresentation(target.id)).toBeNull();
    expect(runtime.resolveSurface(target)).toBeNull();

    finishDecode?.({ decoded: true } as unknown as CanvasImageSource);
    await replacement;

    expect(runtime.getPresentation(target.id)).not.toBeNull();
  });

  test("retains removed surfaces for history until the document resets", async () => {
    const browser = createFakeCanvasBrowser();
    const runtime = createCanvas2dRasterRuntime(browser.capabilities);

    await Promise.all([
      runtime.ensureSurface({
        height: target.pixelSize.height,
        id: target.id,
        src: "data:image/png;base64,first",
        width: target.pixelSize.width,
      }),
      runtime.ensureSurface({
        height: 10,
        id: "removed-raster",
        src: "data:image/png;base64,second",
        width: 10,
      }),
    ]);

    runtime.retainTargets?.([target.id]);

    expect(runtime.getPresentation(target.id)).not.toBeNull();
    expect(runtime.getPresentation("removed-raster")).not.toBeNull();

    runtime.resetSurfaces();

    expect(runtime.getPresentation(target.id)).toBeNull();
    expect(runtime.getPresentation("removed-raster")).toBeNull();
  });

  test("can retry a failed source decode", async () => {
    const browser = createFakeCanvasBrowser();
    let decodeCount = 0;
    const runtime = createCanvas2dRasterRuntime({
      ...browser.capabilities,
      decodeImage: () => {
        decodeCount += 1;

        if (decodeCount === 1) {
          return Promise.reject(new Error("decode failed"));
        }

        return Promise.resolve({ decoded: true });
      },
    });
    const input = {
      height: target.pixelSize.height,
      id: target.id,
      src: "data:image/png;base64,existing",
      width: target.pixelSize.width,
    };

    await expect(runtime.ensureSurface(input)).rejects.toThrow("decode failed");
    await runtime.ensureSurface(input);

    expect(decodeCount).toBe(2);
    expect(runtime.getPresentation(target.id)).not.toBeNull();
  });

  test("maps one stable Canvas through resized source geometry", async () => {
    const browser = createFakeCanvasBrowser();
    const runtime = createCanvas2dRasterRuntime(browser.capabilities);
    const presentation = await runtime.ensureSurface({
      bounds: { height: 100, width: 120, x: -20, y: -10 },
      height: 100,
      id: target.id,
      sourceBounds: { height: 60, width: 80, x: 0, y: 0 },
      src: "data:image/png;base64,existing",
      width: 120,
    });

    expect(
      runtime.getSurfaceGeometry(target.id, {
        height: 120,
        width: 160,
        x: 0,
        y: 0,
      })
    ).toEqual({
      bounds: { height: 200, width: 240, x: -40, y: -20 },
      pixelSize: { height: 100, width: 120 },
    });
    expect(
      runtime.snapshotSurface(target.id, {
        height: 120,
        width: 160,
        x: 0,
        y: 0,
      })
    ).toMatchObject({ height: 200, width: 240, x: -40, y: -20 });
    expect(runtime.getPresentation(target.id)?.canvas).toBe(
      presentation.canvas
    );
  });

  test("lazy decode allocates persisted samples behind resized geometry", async () => {
    const browser = createFakeCanvasBrowser();
    const runtime = createCanvas2dRasterRuntime({
      ...browser.capabilities,
      decodeImage: async () => ({ decoded: true }),
    });
    const presentation = await runtime.ensureSurface({
      bounds: { height: 120, width: 160, x: 0, y: 0 },
      height: 60,
      id: target.id,
      sourceBounds: { height: 120, width: 160, x: 0, y: 0 },
      src: "data:image/png;base64,resized",
      width: 80,
    });

    expect({
      height: presentation.canvas.height,
      width: presentation.canvas.width,
    }).toEqual({ height: 60, width: 80 });
    expect(
      runtime.getSurfaceGeometry(target.id, {
        height: 120,
        width: 160,
        x: 0,
        y: 0,
      })
    ).toEqual({
      bounds: { height: 120, width: 160, x: 0, y: 0 },
      pixelSize: { height: 60, width: 80 },
    });
  });

  test("paints Hard Round dabs on the stable presented surface and reports dirty pixels", async () => {
    const browser = createFakeCanvasBrowser();
    const runtime = createCanvas2dRasterRuntime(browser.capabilities);

    await runtime.ensureSurface({
      height: target.pixelSize.height,
      id: target.id,
      src: "data:image/png;base64,existing",
      width: target.pixelSize.width,
    });

    const presentation = runtime.getPresentation(target.id);
    const surface = runtime.resolveSurface(target);

    expect(surface).not.toBeNull();
    if (!surface) {
      throw new Error("Expected a prepared Canvas2D Raster surface");
    }
    expect(runtime.getPresentation(target.id)?.canvas).toBe(
      presentation?.canvas
    );

    const stroke = createRasterStroke({
      operation: "paint",
      point: { x: 50, y: 50 },
      settings: { ...settings, opacity: 1 },
      surface,
      target,
    });
    stroke.append([{ x: 55, y: 50 }]);
    const commit = stroke.commit();
    const presentedContext = browser.contexts.get(presentation?.canvas);

    expect(presentedContext?.compositeModes).toContain("source-over");
    expect(presentedContext?.arcs).toContainEqual({
      endAngle: Math.PI * 2,
      radius: 20,
      startAngle: 0,
      x: 100,
      y: 100,
    });
    expect(presentedContext?.fillCount).toBeGreaterThan(0);
    expect(presentedContext?.fillCount).toBeLessThanOrEqual(
      presentedContext?.arcs.length ?? 0
    );
    expect(commit).toMatchObject({
      dirtyRegion: { height: 40, width: 50, x: 80, y: 80 },
      targetId: target.id,
    });
    expect(browser.hotPathReadbacks).toEqual([]);
    expect(browser.encodes).toEqual([]);
  });

  test("commits an exact reversible patch without replacing or encoding the presented canvas", async () => {
    const browser = createFakeCanvasBrowser();
    const runtime = createCanvas2dRasterRuntime(browser.capabilities);

    await runtime.ensureSurface({
      height: target.pixelSize.height,
      id: target.id,
      src: "data:image/png;base64,existing",
      width: target.pixelSize.width,
    });

    const presentation = runtime.getPresentation(target.id);
    const surface = runtime.resolveSurface(target);

    if (!surface) {
      throw new Error("Expected a prepared Canvas2D Raster surface");
    }

    const stroke = createRasterStroke({
      operation: "paint",
      point: { x: 50, y: 50 },
      settings: { ...settings, opacity: 1 },
      surface,
      target,
    });
    stroke.append([{ x: 55, y: 50 }]);

    const commit = stroke.commit();
    const presentedContext = browser.contexts.get(presentation?.canvas);
    const drawCountAfterCommit = presentedContext?.drawImageCalls.length ?? 0;

    commit.patch?.undo();
    const drawCountAfterUndo = presentedContext?.drawImageCalls.length ?? 0;
    commit.patch?.redo();

    expect(commit.patch).toBeDefined();
    expect(drawCountAfterUndo).toBeGreaterThan(drawCountAfterCommit);
    expect(presentedContext?.drawImageCalls.length).toBeGreaterThan(
      drawCountAfterUndo
    );
    expect(runtime.getPresentation(target.id)?.canvas).toBe(
      presentation?.canvas
    );
    expect(browser.encodes).toEqual([]);
  });

  test("composites translucent Hard Round dabs separately", async () => {
    const browser = createFakeCanvasBrowser();
    const runtime = createCanvas2dRasterRuntime(browser.capabilities);

    await runtime.ensureSurface({
      height: target.pixelSize.height,
      id: target.id,
      src: "data:image/png;base64,existing",
      width: target.pixelSize.width,
    });
    const surface = runtime.resolveSurface(target);

    if (!surface) {
      throw new Error("Expected a prepared Canvas2D Raster surface");
    }

    const stroke = createRasterStroke({
      operation: "paint",
      point: { x: 50, y: 50 },
      settings,
      surface,
      target,
    });

    stroke.append([{ x: 55, y: 50 }]);
    stroke.commit();

    const context = browser.contexts.get(
      runtime.getPresentation(target.id)?.canvas
    );

    expect(context?.arcs).toEqual([]);
    expect(context?.drawImageCalls.length).toBeGreaterThan(1);
  });

  test("captures the complete rotated sampled-tip dirty patch", async () => {
    const browser = createFakeCanvasBrowser();
    const runtime = createCanvas2dRasterRuntime(browser.capabilities);

    await runtime.ensureSurface({
      height: target.pixelSize.height,
      id: target.id,
      src: "data:image/png;base64,existing",
      width: target.pixelSize.width,
    });
    const surface = runtime.resolveSurface(target);

    if (!surface) {
      throw new Error("Expected a prepared Canvas2D Raster surface");
    }

    const commit = createRasterStroke({
      operation: "paint",
      point: { x: 50, y: 50 },
      settings: {
        ...settings,
        angle: 45,
        opacity: 1,
        tip: { kind: "sampled", sampleId: "pixel" },
      },
      surface,
      target,
    }).commit();

    expect(commit.dirtyRegion).toEqual({
      height: 58,
      width: 58,
      x: 71,
      y: 71,
    });
  });

  test("does not connect native Hard Round runs separated outside the target", async () => {
    const browser = createFakeCanvasBrowser();
    const runtime = createCanvas2dRasterRuntime(browser.capabilities);

    await runtime.ensureSurface({
      height: target.pixelSize.height,
      id: target.id,
      src: "data:image/png;base64,existing",
      width: target.pixelSize.width,
    });
    const surface = runtime.resolveSurface(target);

    if (!surface) {
      throw new Error("Expected a prepared Canvas2D Raster surface");
    }

    const stroke = createRasterStroke({
      operation: "paint",
      point: { x: 10, y: 50 },
      settings: { ...settings, opacity: 1 },
      surface,
      target,
    });

    stroke.append([
      { x: -30, y: 50 },
      { x: 10, y: 70 },
    ]);
    stroke.commit();

    const context = browser.contexts.get(
      runtime.getPresentation(target.id)?.canvas
    );

    expect(context?.strokeCount).toBe(2);
  });

  test("notifies exact presentations when resident pixels change", async () => {
    const browser = createFakeCanvasBrowser();
    const runtime = createCanvas2dRasterRuntime(browser.capabilities);

    await runtime.ensureSurface({
      height: target.pixelSize.height,
      id: target.id,
      src: "data:image/png;base64,existing",
      width: target.pixelSize.width,
    });
    const surface = runtime.resolveSurface(target);
    let presentationChanges = 0;
    const unsubscribe = runtime.subscribePresentation(target.id, () => {
      presentationChanges += 1;
    });

    if (!surface) {
      throw new Error("Expected a prepared Canvas2D Raster surface");
    }

    const stroke = createRasterStroke({
      operation: "paint",
      point: { x: 50, y: 50 },
      settings,
      surface,
      target,
    });

    stroke.append([{ x: 55, y: 50 }]);
    expect(presentationChanges).toBe(2);

    stroke.cancel();
    expect(presentationChanges).toBe(3);

    unsubscribe();
  });

  test("uses destination-out for Eraser and restores only dirty pixels on cancel", async () => {
    const browser = createFakeCanvasBrowser();
    const runtime = createCanvas2dRasterRuntime(browser.capabilities);

    await runtime.ensureSurface({
      height: target.pixelSize.height,
      id: target.id,
      src: "data:image/png;base64,existing",
      width: target.pixelSize.width,
    });

    const presentation = runtime.getPresentation(target.id);
    const surface = runtime.resolveSurface(target);

    if (!surface) {
      throw new Error("Expected a prepared Canvas2D Raster surface");
    }

    const stroke = createRasterStroke({
      operation: "erase",
      point: { x: 25, y: 25 },
      settings,
      surface,
      target,
    });

    stroke.cancel();

    const presentedContext = browser.contexts.get(presentation?.canvas);

    expect(presentedContext?.compositeModes).toContain("destination-out");
    expect(presentedContext?.drawImageCalls.at(-1)?.slice(1)).toEqual([30, 30]);
    expect(runtime.getPresentation(target.id)?.canvas).toBe(
      presentation?.canvas
    );
    expect(browser.hotPathReadbacks).toEqual([]);
    expect(browser.encodes).toEqual([]);
  });

  test("renders every built-in through cached generated and sampled tips", async () => {
    const browser = createFakeCanvasBrowser();
    const runtime = createCanvas2dRasterRuntime(browser.capabilities);

    await runtime.ensureSurface({
      height: target.pixelSize.height,
      id: target.id,
      src: "data:image/png;base64,existing",
      width: target.pixelSize.width,
    });
    const surface = runtime.resolveSurface(target);

    if (!surface) {
      throw new Error("Expected a prepared Canvas2D Raster surface");
    }

    for (const [index, preset] of RASTER_BRUSH_PRESETS.entries()) {
      const stroke = createRasterStroke({
        operation: "paint",
        point: { x: 20 + index * 5, y: 50 },
        settings: {
          ...preset.settings,
          color: "#3366FF",
          seed: 100 + index,
          tip: { ...preset.settings.tip },
        },
        surface,
        target,
      });

      stroke.append([{ x: 25 + index * 5, y: 50 }]);
      stroke.commit();
    }

    const presentedContext = browser.contexts.get(
      runtime.getPresentation(target.id)?.canvas
    );
    const tipCanvases = browser.createdCanvasSizes.filter(
      ({ height, width }) => height <= 64 && width <= 64
    );

    expect(presentedContext?.drawImageCalls.length).toBeGreaterThan(0);
    expect(presentedContext?.rotations.length).toBeGreaterThan(0);
    expect(tipCanvases.length).toBeLessThan(40);
    expect(browser.hotPathReadbacks).toEqual([]);
    expect(browser.encodes).toEqual([]);
  });

  test("caches generated and sampled tips by rendering inputs", () => {
    const browser = createFakeCanvasBrowser();
    const cache = createCanvas2dBrushTipCache(browser.capabilities);
    const generatedDab = {
      angle: 0,
      center: { x: 0, y: 0 },
      color: "#3366FF",
      flow: 1,
      hardness: 0.5,
      opacity: 1,
      roundness: 1,
      size: 24,
      tip: { kind: "round" as const },
    };
    const sampledDab = {
      ...generatedDab,
      tip: { kind: "sampled" as const, sampleId: "chalk" },
    };

    expect(cache.get(generatedDab)).toBe(cache.get(generatedDab));
    expect(cache.get(sampledDab)).toBe(cache.get(sampledDab));
    expect(cache.get(sampledDab)).not.toBe(cache.get(generatedDab));
    expect(browser.createdCanvasSizes).toEqual([
      { height: 64, width: 64 },
      { height: 12, width: 12 },
    ]);
  });
});

describe("Editor Raster surface injection", () => {
  test("routes soft and translucent strokes through the injected surface", () => {
    let resolveCount = 0;
    const editor = new Editor({
      rasterSurface: {
        resolveSurface: () => {
          resolveCount += 1;
          return createRasterOperationRecorder();
        },
      },
    });
    const node = {
      ...createDefaultImageNode({
        height: 100,
        src: "data:image/png;base64,existing",
        width: 100,
      }),
      id: target.id,
    };

    editor.insertNodes([node]);
    editor.setBrushSettings({ hardness: 0.5 }, "brush");
    editor.setActiveTool("brush");
    editor.currentTool.onNodePointerDown({
      node,
      point: { x: 2275, y: 2730 },
    });

    editor.setBrushSettings({ hardness: 1, opacity: 0.5 }, "brush");
    const session = editor.currentTool.onNodePointerDown({
      node,
      point: { x: 2275, y: 2730 },
    });

    expect(resolveCount).toBe(2);
    session?.cancel();
  });

  test("reconciles retained Raster targets through editor mount and dispose", () => {
    const retainedTargets: string[][] = [];
    const editor = new Editor({
      rasterSurface: {
        resolveSurface: () => null,
        retainTargets: (targetIds) => {
          retainedTargets.push([...targetIds]);
        },
      },
    });
    const node = {
      ...createDefaultImageNode({
        height: 100,
        src: "data:image/png;base64,existing",
        width: 100,
      }),
      id: target.id,
    };

    editor.mount();
    editor.insertNodes([node]);
    editor.deleteNode(node.id);
    editor.dispose();

    expect(retainedTargets).toContainEqual([node.id]);
    expect(retainedTargets.at(-1)).toEqual([]);
  });

  test("preserves resident pixels across editor deactivate and remount", async () => {
    const browser = createFakeCanvasBrowser();
    const runtime = createCanvas2dRasterRuntime(browser.capabilities);
    const editor = new Editor({ rasterSurface: runtime });
    const node = {
      ...createDefaultImageNode({
        height: 100,
        src: "data:image/png;base64,existing",
        width: 100,
      }),
      id: target.id,
    };

    editor.insertNodes([node]);
    const presentation = await runtime.ensureSurface({
      height: 100,
      id: node.id,
      src: node.src,
      width: 100,
    });
    editor.mount();
    editor.dispose();
    editor.mount();

    expect(runtime.getPresentation(node.id)?.canvas).toBe(presentation.canvas);

    editor.dispose();
  });

  test("routes an existing single-payload image stroke through the injected surface", async () => {
    const recorder = createRasterOperationRecorder();
    let resolvedTarget: RasterTarget | null = null;
    const editor = new Editor({
      rasterSurface: {
        resolveSurface: (nextTarget) => {
          resolvedTarget = structuredClone(nextTarget);
          return recorder;
        },
      },
    });
    const node = {
      ...createDefaultImageNode({
        height: 100,
        src: "data:image/png;base64,existing",
        width: 100,
      }),
      id: target.id,
    };

    editor.insertNodes([node]);
    editor.setActiveTool("brush");
    editor.markDocumentSaved();
    const session = editor.currentTool.onNodePointerDown({
      node,
      point: { x: 2275, y: 2730 },
    });

    expect(session).not.toBeNull();
    await session?.complete({ point: { x: 2285, y: 2730 } });

    expect(resolvedTarget).toEqual({
      bounds: { height: 100, width: 100, x: 0, y: 0 },
      id: target.id,
      pixelSize: { height: 100, width: 100 },
      writableBounds: { height: 100, width: 100, x: 0, y: 0 },
      writablePolygon: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
    });
    expect(recorder.commits).toHaveLength(1);
    expect(recorder.commits[0]?.context).toMatchObject({
      operation: "paint",
      target: { id: target.id },
    } satisfies Partial<RasterStrokeContext>);
  });

  test("records one Brush dirty patch that Undo and Redo apply exactly", async () => {
    const patchActions: string[] = [];
    const editor = new Editor({
      rasterSurface: {
        resolveSurface: () => ({
          beginStroke: (context: RasterStrokeContext) => ({
            applyDabs: () => undefined,
            cancel: () => undefined,
            commit: () => ({
              dirtyRegion: { height: 12, width: 18, x: 20, y: 24 },
              patch: {
                redo: () => patchActions.push("redo"),
                undo: () => patchActions.push("undo"),
              },
              targetId: context.target.id,
            }),
          }),
        }),
      },
    });
    const node = {
      ...createDefaultImageNode({
        height: 100,
        src: "data:image/png;base64,existing",
        width: 100,
      }),
      id: target.id,
    };

    editor.insertNodes([node]);
    editor.setActiveTool("brush");
    editor.markDocumentSaved();
    const revisionBeforeStroke = editor.history.currentRevision;
    const session = editor.currentTool.onNodePointerDown({
      node,
      point: { x: 2275, y: 2730 },
    });

    await session?.complete({ point: { x: 2285, y: 2730 } });

    expect(editor.history.currentRevision).toBe(revisionBeforeStroke + 1);
    expect(editor.isDirty).toBe(true);
    expect(patchActions).toEqual([]);
    expect(editor.undo()).toBe(true);
    expect(editor.isDirty).toBe(false);
    expect(patchActions).toEqual(["undo"]);
    expect(editor.redo()).toBe(true);
    expect(editor.isDirty).toBe(true);
    expect(patchActions).toEqual(["undo", "redo"]);
  });

  test("restores a Frame-created Raster on the same resident Canvas after Undo and Redo", async () => {
    const browser = createFakeCanvasBrowser();
    const runtime = createCanvas2dRasterRuntime(browser.capabilities);
    const editor = new Editor({ rasterSurface: runtime });
    const frame = {
      ...createDefaultArtboardNode(),
      height: 100,
      id: "frame",
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
      },
      width: 100,
    };

    editor.mount();
    editor.insertNodes([frame]);
    editor.select(frame.id);
    editor.setActiveTool("brush");
    await editor
      .dispatchCanvasPointerDown({ point: { x: 40, y: 40 } })
      ?.complete({ point: { x: 60, y: 40 } });

    const raster = editor.nodes.find((node) => node.type === "image");
    const canvas = raster
      ? runtime.getPresentation(raster.id)?.canvas
      : undefined;

    expect(canvas).toBeDefined();
    expect(editor.undo()).toBe(true);
    expect(editor.redo()).toBe(true);
    expect(runtime.getPresentation(raster?.id || "missing")?.canvas).toBe(
      canvas
    );

    editor.dispose();
  });

  test("Undo cancels an active Frame-created Raster before reading history", async () => {
    const browser = createFakeCanvasBrowser();
    const runtime = createCanvas2dRasterRuntime(browser.capabilities);
    const editor = new Editor({ rasterSurface: runtime });
    const frame = {
      ...createDefaultArtboardNode(),
      height: 100,
      id: "frame",
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
      },
      width: 100,
    };

    editor.getState().loadNodes([frame]);
    editor.resetHistory();
    editor.select(frame.id);
    editor.setActiveTool("brush");
    const session = editor.dispatchCanvasPointerDown({
      point: { x: 40, y: 40 },
    });

    await session?.ready;
    expect(editor.nodes.some((node) => node.type === "image")).toBe(true);

    expect(editor.undo()).toBe(false);
    expect(editor.nodes).toEqual([frame]);

    editor.dispose();
  });

  test("async persistence excludes an uncommitted Frame-created Raster", async () => {
    const browser = createFakeCanvasBrowser();
    const runtime = createCanvas2dRasterRuntime(browser.capabilities);
    const editor = new Editor({ rasterSurface: runtime });
    const frame = {
      ...createDefaultArtboardNode(),
      height: 100,
      id: "frame",
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
      },
      width: 100,
    };

    editor.getState().loadNodes([frame]);
    editor.resetHistory();
    editor.select(frame.id);
    editor.setActiveTool("brush");
    const session = editor.dispatchCanvasPointerDown({
      point: { x: 40, y: 40 },
    });

    await session?.ready;
    expect(editor.nodes.some((node) => node.type === "image")).toBe(true);

    const serialized = JSON.parse(await editor.serializeDocumentAsync());

    expect(serialized.nodes).toEqual([frame]);
    session?.cancel();
    editor.dispose();
  });

  test("asynchronously serializes the latest committed resident Raster revision", async () => {
    const latestSource = "data:image/png;base64,bGF0ZXN0LXBpeGVscw==";
    const editor = new Editor({
      rasterSurface: {
        resolveSurface: () => ({
          beginStroke: (context: RasterStrokeContext) => ({
            applyDabs: () => undefined,
            cancel: () => undefined,
            commit: () => ({
              dirtyRegion: { height: 8, width: 8, x: 20, y: 20 },
              targetId: context.target.id,
            }),
          }),
        }),
        snapshotSurfaceAsync: async () => ({
          height: 100,
          src: latestSource,
          width: 100,
        }),
      },
    });
    const node = {
      ...createDefaultImageNode({
        height: 100,
        src: "data:image/png;base64,c3RhbGU=",
        width: 100,
      }),
      id: target.id,
    };

    editor.insertNodes([node]);
    editor.setActiveTool("brush");
    const session = editor.currentTool.onNodePointerDown({
      node,
      point: { x: 2275, y: 2730 },
    });
    await session?.complete({ point: { x: 2285, y: 2730 } });

    const serialized = JSON.parse(await editor.serializeDocumentAsync());
    const reopened = new Editor();

    reopened.loadDocument(JSON.stringify(serialized));

    expect(serialized.nodes[0].src).toBe(latestSource);
    expect(reopened.getNode(target.id)?.src).toBe(latestSource);
    expect(await editor.exportDocument()).toContain(latestSource);
  });

  test("durable serialization preserves the retained Canvas behind Crop", async () => {
    const snapshotRegions: Array<{
      height: number;
      width: number;
      x: number;
      y: number;
    }> = [];
    const editor = new Editor({
      rasterSurface: {
        getSurfaceGeometry: () => ({
          bounds: { height: 100, width: 100, x: 0, y: 0 },
          pixelSize: { height: 100, width: 100 },
        }),
        resolveSurface: () => null,
        snapshotSurfaceAsync: (_targetId, region) => {
          snapshotRegions.push(region);
          return Promise.resolve({
            height: region.height,
            src: "data:image/png;base64,cmV0YWluZWQ=",
            width: region.width,
          });
        },
      },
    });
    const cropped = {
      ...createDefaultImageNode({
        height: 50,
        src: "data:image/png;base64,c3RhbGU=",
        width: 100,
      }),
      baseHeight: 100,
      baseWidth: 100,
      height: 50,
      id: target.id,
      width: 100,
    };

    editor.getState().loadNodes([cropped]);

    const serialized = JSON.parse(await editor.serializeDocumentAsync());

    expect(snapshotRegions).toEqual([{ height: 100, width: 100, x: 0, y: 0 }]);
    expect(serialized.nodes[0]).toMatchObject({
      baseHeight: 100,
      baseWidth: 100,
      baseX: 0,
      baseY: 0,
      height: 50,
      width: 100,
    });
  });
});

const createFakeCanvasBrowser = () => {
  const contexts = new Map<object, ReturnType<typeof createFakeContext>>();
  const createdCanvasSizes: Array<{ height: number; width: number }> = [];
  const encodes: string[] = [];
  const hotPathReadbacks: string[] = [];

  const createCanvas = (width: number, height: number) => {
    createdCanvasSizes.push({ height, width });
    const canvas = {
      height,
      width,
      getContext: () => {
        let context = contexts.get(canvas);

        if (!context) {
          context = createFakeContext();
          contexts.set(canvas, context);
        }

        return context;
      },
      toDataURL: () => {
        encodes.push("toDataURL");
        return "";
      },
    };

    return canvas;
  };

  const createFakeContext = () => ({
    arcs: [] as Array<{
      endAngle: number;
      radius: number;
      startAngle: number;
      x: number;
      y: number;
    }>,
    beginPath: () => undefined,
    clip: () => undefined,
    closePath: () => undefined,
    clearRect: () => undefined,
    compositeModes: [] as string[],
    drawImageCalls: [] as unknown[][],
    fillCount: 0,
    fill() {
      this.fillCount += 1;
    },
    fillStyle: "",
    fillRect: () => undefined,
    ellipse: () => undefined,
    createRadialGradient: () => ({
      addColorStop: () => undefined,
    }),
    get globalCompositeOperation() {
      return this.compositeModes.at(-1) || "source-over";
    },
    set globalCompositeOperation(value: string) {
      this.compositeModes.push(value);
    },
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    lineTo(x: number, y: number) {
      this.lineToCalls.push({ x, y });
    },
    lineToCalls: [] as Array<{ x: number; y: number }>,
    stroke() {
      this.strokeCount += 1;
    },
    strokeCount: 0,
    arc(
      x: number,
      y: number,
      radius: number,
      startAngle: number,
      endAngle: number
    ) {
      this.arcs.push({ endAngle, radius, startAngle, x, y });
    },
    drawImage(...args: unknown[]) {
      this.drawImageCalls.push(args);
    },
    getImageData() {
      hotPathReadbacks.push("getImageData");
      throw new Error("getImageData must stay off the Raster stroke path");
    },
    moveTo: () => undefined,
    putImageData() {
      hotPathReadbacks.push("putImageData");
      throw new Error("putImageData must stay off the Raster stroke path");
    },
    restore: () => undefined,
    rotate(value: number) {
      this.rotations.push(value);
    },
    rect: () => undefined,
    rotations: [] as number[],
    save: () => undefined,
    scale: () => undefined,
    translate: () => undefined,
  });

  return {
    capabilities: {
      createCanvas,
      decodeImage: async () => ({ decoded: true }),
      encodeCanvas: async (canvas) => canvas.toDataURL("image/png"),
    },
    contexts,
    createdCanvasSizes,
    encodes,
    hotPathReadbacks,
  };
};
