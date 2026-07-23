import { describe, expect, test } from "bun:test";
import {
  createDefaultImageNode,
  createRasterOperationRecorder,
  createRasterStroke,
  Editor,
  type RasterStrokeContext,
  type RasterStrokeSettings,
  type RasterTarget,
} from "@punchpress/engine";
import { createCanvas2dRasterRuntime } from "../../src/platform/raster/canvas2d-raster-runtime";

const settings: RasterStrokeSettings = {
  color: "#3366FF",
  hardness: 1,
  opacity: 0.75,
  size: 20,
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
      settings,
      surface,
      target,
    });
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
    expect(commit).toEqual({
      dirtyRegion: { height: 40, width: 40, x: 80, y: 80 },
      targetId: target.id,
    });
    expect(browser.hotPathReadbacks).toEqual([]);
    expect(browser.encodes).toEqual([]);
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
});

describe("Editor Raster surface injection", () => {
  test("leaves soft strokes on the legacy path", () => {
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
      point: { x: 25, y: 30 },
    });

    expect(resolveCount).toBe(0);
  });

  test("routes an existing single-payload image stroke through the injected surface", () => {
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
    const session = editor.currentTool.onNodePointerDown({
      node,
      point: { x: 25, y: 30 },
    });

    expect(session).not.toBeNull();
    session?.complete({ point: { x: 35, y: 30 } });

    expect(resolvedTarget).toEqual({
      bounds: { height: 100, width: 100, x: 0, y: 0 },
      id: target.id,
      pixelSize: { height: 100, width: 100 },
    });
    expect(recorder.commits).toHaveLength(1);
    expect(recorder.commits[0]?.context).toMatchObject({
      operation: "paint",
      target: { id: target.id },
    } satisfies Partial<RasterStrokeContext>);
  });
});

const createFakeCanvasBrowser = () => {
  const contexts = new Map<object, ReturnType<typeof createFakeContext>>();
  const encodes: string[] = [];
  const hotPathReadbacks: string[] = [];

  const createCanvas = (width: number, height: number) => {
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
    clearRect: () => undefined,
    compositeModes: [] as string[],
    drawImageCalls: [] as unknown[][],
    fill: () => undefined,
    fillStyle: "",
    ellipse: () => undefined,
    get globalCompositeOperation() {
      return this.compositeModes.at(-1) || "source-over";
    },
    set globalCompositeOperation(value: string) {
      this.compositeModes.push(value);
    },
    globalAlpha: 1,
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
    save: () => undefined,
  });

  return {
    capabilities: {
      createCanvas,
      decodeImage: async () => ({ decoded: true }),
    },
    contexts,
    encodes,
    hotPathReadbacks,
  };
};
