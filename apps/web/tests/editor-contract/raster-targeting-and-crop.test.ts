import { describe, expect, test } from "bun:test";
import {
  createDefaultArtboardNode,
  createDefaultEmptyNode,
  createDefaultGroupNode,
  createDefaultImageNode,
  createDefaultNode,
  createDefaultShapeNode,
  createRasterOperationRecorder,
  createRasterStroke,
  Editor,
  getNodeWorldPoint,
  type RasterTarget,
} from "@punchpress/engine";

const IMAGE_SOURCE = "data:image/png;base64,existing";
const getImageBounds = (node: { height: number; width: number }) => ({
  height: node.height,
  maxX: node.width,
  maxY: node.height,
  minX: 0,
  minY: 0,
  width: node.width,
});

const createImage = (id: string, overrides: Record<string, unknown> = {}) => ({
  ...createDefaultImageNode({
    height: 100,
    src: IMAGE_SOURCE,
    width: 100,
  }),
  id,
  transform: {
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    x: 100,
    y: 100,
  },
  ...overrides,
});

const createFrame = (id: string, overrides: Record<string, unknown> = {}) => ({
  ...createDefaultArtboardNode(),
  height: 400,
  id,
  transform: {
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    x: 0,
    y: 0,
  },
  width: 500,
  ...overrides,
});

describe("Raster targeting", () => {
  test("rejects an invalid append batch before advancing Dab state", () => {
    const recorder = createRasterOperationRecorder();
    const stroke = createRasterStroke({
      operation: "paint",
      point: { x: 0, y: 5 },
      settings: {
        color: "#000000",
        hardness: 1,
        opacity: 1,
        size: 2,
        smoothing: 0,
        spacing: 1,
        tip: { kind: "round" },
      },
      surface: recorder,
      target: {
        bounds: { height: 10, width: 100, x: 0, y: 0 },
        id: "raster",
        pixelSize: { height: 10, width: 100 },
      },
    });

    expect(() =>
      stroke.append([
        { x: 10, y: 5 },
        { x: Number.NaN, y: 5 },
      ])
    ).toThrow();
    stroke.append([{ x: 20, y: 5 }]);
    stroke.commit();

    expect(recorder.commits[0]?.dabs.map((dab) => dab.center.x)).toEqual([
      0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20,
    ]);
  });

  test("active writable Raster stays locked and allocates only after intersection", async () => {
    const recorders = new Map([
      ["raster-a", createRasterOperationRecorder()],
      ["raster-b", createRasterOperationRecorder()],
    ]);
    const resolvedTargets: RasterTarget[] = [];
    const editor = new Editor({
      rasterSurface: {
        resolveSurface: (target: RasterTarget) => {
          resolvedTargets.push(structuredClone(target));
          return recorders.get(target.id) || null;
        },
      },
    });
    const rasterA = createImage("raster-a");
    const rasterB = createImage("raster-b", {
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 300,
        y: 100,
      },
    });

    editor.insertNodes([rasterA, rasterB]);
    editor.select(rasterA.id);
    editor.clearSelection();
    editor.setActiveTool("brush");
    const session = editor.dispatchNodePointerDown({
      node: rasterB,
      point: { x: 50, y: 125 },
    });

    expect(session).not.toBeNull();
    expect(resolvedTargets).toHaveLength(0);
    editor.select(rasterB.id);
    session?.update({ point: { x: 150, y: 125 } });
    await session?.complete({ point: { x: 1_000_000, y: 125 } });

    expect(resolvedTargets.map((target) => target.id)).toEqual(["raster-a"]);
    expect(recorders.get("raster-a")?.commits).toHaveLength(1);
    expect(recorders.get("raster-b")?.commits).toHaveLength(0);
    expect(recorders.get("raster-a")?.commits[0]?.dabs.length).toBeLessThan(
      200
    );
    expect(
      recorders
        .get("raster-a")
        ?.commits[0]?.dabs.every((dab) => Math.abs(dab.center.x) <= 200)
    ).toBe(true);
  });

  test("outside-only Raster gesture is allocation-free and leaves no history", async () => {
    const recorder = createRasterOperationRecorder();
    let resolveCount = 0;
    const editor = new Editor({
      rasterSurface: {
        resolveSurface: () => {
          resolveCount += 1;
          return recorder;
        },
      },
    });
    const raster = createImage("raster");

    editor.insertNodes([raster]);
    editor.clearSelection();
    editor.resetHistory();
    editor.setActiveTool("brush");
    const session = editor.dispatchCanvasPointerDown({
      point: { x: -1_000_000, y: -1_000_000 },
    });

    session?.update({ point: { x: -500_000, y: -500_000 } });
    await session?.complete({ point: { x: -250_000, y: -250_000 } });

    expect(session).not.toBeNull();
    expect(resolveCount).toBe(0);
    expect(recorder.commits).toHaveLength(0);
    expect(editor.getNode(raster.id)).toEqual(raster);
    expect(editor.canUndo).toBe(false);
  });

  test("active Frame creates one Raster only when an outside gesture intersects", async () => {
    const recorder = createRasterOperationRecorder();
    let resolveCount = 0;
    const editor = new Editor({
      rasterSurface: {
        resolveSurface: () => {
          resolveCount += 1;
          return recorder;
        },
      },
    });
    const frame = createFrame("frame", { height: 100, width: 100 });
    const unrelated = {
      ...createDefaultShapeNode(),
      id: "other",
    };

    editor.insertNodes([frame, unrelated]);
    editor.select(frame.id);
    editor.clearSelection();
    editor.resetHistory();
    editor.setActiveTool("brush");
    const session = editor.dispatchCanvasPointerDown({
      point: { x: -500, y: 50 },
    });

    session?.update({ point: { x: -100, y: 50 } });

    expect(editor.nodes).toEqual([frame, unrelated]);
    expect(resolveCount).toBe(0);
    expect(editor.canUndo).toBe(false);

    session?.update({ point: { x: 50, y: 50 } });

    const raster = editor.nodes.find((node) => node.type === "image");
    expect(raster).toMatchObject({
      parentId: frame.id,
      type: "image",
    });
    expect(editor.activeLayerId).toBe(raster?.id);
    expect(resolveCount).toBe(1);

    await session?.complete({ point: { x: 80, y: 50 } });

    expect(recorder.commits).toHaveLength(1);
    expect(editor.currentTool.hasActiveSession()).toBe(false);
    expect(editor.canUndo).toBe(true);
    expect(editor.undo()).toBe(true);
    expect(editor.nodes).toEqual([frame, unrelated]);
    expect(editor.activeLayerId).toBe(frame.id);
  });

  test("canceling headless Frame materialization restores state and retires the session", () => {
    const recorder = createRasterOperationRecorder();
    const editor = new Editor({
      rasterSurface: {
        resolveSurface: () => recorder,
      },
    });
    const frame = createFrame("frame", { height: 100, width: 100 });
    const unrelated = {
      ...createDefaultShapeNode(),
      id: "other",
    };

    editor.insertNodes([frame, unrelated]);
    editor.select(frame.id);
    editor.clearSelection();
    editor.resetHistory();
    editor.setActiveTool("brush");
    const session = editor.dispatchCanvasPointerDown({
      point: { x: -100, y: 50 },
    });

    session?.update({ point: { x: 50, y: 50 } });

    expect(editor.nodes.some((node) => node.type === "image")).toBe(true);
    expect(editor.currentTool.hasActiveSession()).toBe(true);

    session?.cancel();

    expect(editor.nodes).toEqual([frame, unrelated]);
    expect(editor.activeLayerId).toBe(frame.id);
    expect(editor.currentTool.hasActiveSession()).toBe(false);
    expect(recorder.commits).toHaveLength(0);
    expect(editor.canUndo).toBe(false);
  });

  test("active empty layer materializes at first Frame intersection in one history seam", async () => {
    const recorder = createRasterOperationRecorder();
    const editor = new Editor({
      rasterSurface: {
        resolveSurface: () => recorder,
      },
    });
    const frame = createFrame("frame", { height: 100, width: 100 });
    const empty = {
      ...createDefaultEmptyNode(),
      id: "empty",
      parentId: frame.id,
    };

    editor.insertNodes([frame, empty]);
    editor.select(empty.id);
    editor.clearSelection();
    editor.resetHistory();
    editor.setActiveTool("brush");
    const session = editor.dispatchCanvasPointerDown({
      point: { x: -500, y: 50 },
    });

    expect(editor.getNode(empty.id)?.type).toBe("empty");

    session?.update({ point: { x: 50, y: 50 } });
    await session?.complete({ point: { x: 80, y: 50 } });

    expect(editor.getNode(empty.id)).toMatchObject({
      id: empty.id,
      parentId: frame.id,
      type: "image",
    });
    expect(recorder.commits).toHaveLength(1);
    expect(editor.currentTool.hasActiveSession()).toBe(false);
    expect(editor.canUndo).toBe(true);
    expect(editor.undo()).toBe(true);
    expect(editor.getNode(empty.id)).toEqual(empty);
    expect(editor.canUndo).toBe(false);
  });

  test("only approved active layers can target Brush", () => {
    const editor = new Editor();
    const frame = createFrame("frame");
    const empty = {
      ...createDefaultEmptyNode(),
      id: "empty",
      name: "Ink",
      opacity: 0.4,
      parentId: frame.id,
      visible: true,
    };
    const shape = {
      ...createDefaultShapeNode(),
      id: "shape",
      parentId: frame.id,
    };

    editor.insertNodes([frame, empty, shape]);

    editor.setSelectedNodes([]);
    expect(
      editor.getRasterTargetState({ point: { x: 50, y: 50 }, tool: "brush" })
    ).toMatchObject({ enabled: true, frameId: frame.id, kind: "create" });
    expect(
      editor.getRasterTargetState({
        point: { x: 800, y: 800 },
        tool: "brush",
      })
    ).toMatchObject({ enabled: true, frameId: frame.id, kind: "create" });

    editor.select(frame.id);
    expect(
      editor.getRasterTargetState({ point: { x: 50, y: 50 }, tool: "brush" })
    ).toMatchObject({ enabled: true, frameId: frame.id, kind: "create" });
    expect(
      editor.getRasterTargetState({
        point: { x: 800, y: 800 },
        tool: "brush",
      })
    ).toMatchObject({ enabled: true, frameId: frame.id, kind: "create" });

    editor.select(empty.id);
    expect(editor.getNodeFrame(empty.id)).toBeNull();
    expect(
      editor.getRasterTargetState({ point: { x: 50, y: 50 }, tool: "brush" })
    ).toMatchObject({
      enabled: true,
      frameId: frame.id,
      kind: "materialize",
      nodeId: empty.id,
    });
    expect(
      editor.getRasterTargetState({ point: { x: 50, y: 50 }, tool: "eraser" })
    ).toEqual({ enabled: false, kind: "invalid" });
    expect(
      editor.getRasterTargetState({
        point: { x: 800, y: 800 },
        tool: "brush",
      })
    ).toMatchObject({
      enabled: true,
      frameId: frame.id,
      kind: "materialize",
      nodeId: empty.id,
    });

    editor.getState().updateNodeById(empty.id, (node) => ({
      ...node,
      locked: true,
    }));
    expect(
      editor.getRasterTargetState({ point: { x: 50, y: 50 }, tool: "brush" })
    ).toEqual({ enabled: false, kind: "invalid" });

    editor.select(shape.id);
    expect(
      editor.getRasterTargetState({ point: { x: 50, y: 50 }, tool: "brush" })
    ).toEqual({ enabled: false, kind: "invalid" });

    editor.setSelectedNodes([empty.id, shape.id]);
    expect(
      editor.getRasterTargetState({ point: { x: 50, y: 50 }, tool: "brush" })
    ).toEqual({ enabled: false, kind: "invalid" });
  });

  test("empty and incompatible active layers keep Brush disabled", () => {
    const editor = new Editor();

    expect(editor.activeLayerId).toBeNull();
    expect(
      editor.getRasterTargetState({ point: { x: 50, y: 50 }, tool: "brush" })
    ).toEqual({ enabled: false, kind: "invalid" });

    const shape = {
      ...createDefaultShapeNode(),
      id: "shape",
    };
    editor.insertNodes([shape]);
    editor.clearSelection();

    expect(editor.activeLayerId).toBe(shape.id);
    expect(
      editor.getRasterTargetState({ point: { x: 50, y: 50 }, tool: "brush" })
    ).toEqual({ enabled: false, kind: "invalid" });

    const text = {
      ...createDefaultNode(),
      id: "text",
    };
    editor.insertNodes([text]);
    editor.clearSelection();

    expect(editor.activeLayerId).toBe(text.id);
    expect(
      editor.getRasterTargetState({ point: { x: 50, y: 50 }, tool: "brush" })
    ).toEqual({ enabled: false, kind: "invalid" });

    const raster = createImage("raster");
    editor.insertNodes([raster]);
    editor.clearSelection();
    editor.getState().updateNodeById(raster.id, { visible: false });

    expect(editor.activeLayerId).toBe(raster.id);
    expect(
      editor.getRasterTargetState({ point: { x: 120, y: 120 }, tool: "brush" })
    ).toEqual({ enabled: false, kind: "invalid" });

    editor.getState().updateNodeById(raster.id, {
      locked: true,
      visible: true,
    });

    expect(
      editor.getRasterTargetState({ point: { x: 120, y: 120 }, tool: "brush" })
    ).toEqual({ enabled: false, kind: "invalid" });
  });

  test("cleared selection never retargets from a locked active Frame", () => {
    const editor = new Editor();
    const writableFrame = createFrame("writable-frame");
    const lockedFrame = createFrame("locked-frame", { locked: true });

    editor.insertNodes([writableFrame, lockedFrame]);
    editor.clearSelection();

    expect(
      editor.getRasterTargetState({ point: { x: 50, y: 50 }, tool: "brush" })
    ).toEqual({ enabled: false, kind: "invalid" });

    editor.select(writableFrame.id);
    editor.clearSelection();

    expect(
      editor.getRasterTargetState({
        point: { x: 800, y: 800 },
        tool: "brush",
      })
    ).toMatchObject({
      enabled: true,
      frameId: writableFrame.id,
      kind: "create",
    });
  });

  test("hidden Rasters and Rasters inside locked Frames are not writable", () => {
    const editor = new Editor();
    const frame = createFrame("frame", { locked: true });
    const image = createImage("raster", { parentId: frame.id });

    editor.insertNodes([frame, image]);
    editor.select(image.id);

    expect(
      editor.getRasterTargetState({ point: { x: 120, y: 120 }, tool: "brush" })
    ).toEqual({ enabled: false, kind: "invalid" });

    editor.getState().updateNodeById(frame.id, (node) => ({
      ...node,
      locked: false,
    }));
    editor.getState().updateNodeById(image.id, (node) => ({
      ...node,
      visible: false,
    }));

    expect(
      editor.getRasterTargetState({ point: { x: 120, y: 120 }, tool: "brush" })
    ).toEqual({ enabled: false, kind: "invalid" });
  });

  test("nested Rasters inherit owning Frame bounds and ancestor locks", () => {
    let target: RasterTarget | null = null;
    const editor = new Editor({
      rasterSurface: {
        resolveSurface: (nextTarget: RasterTarget) => {
          target = structuredClone(nextTarget);
          return createRasterOperationRecorder();
        },
      },
    });
    const frame = createFrame("frame", { height: 100, width: 100 });
    const group = {
      ...createDefaultGroupNode(),
      id: "group",
      locked: false,
      parentId: frame.id,
    };
    const image = createImage("raster", {
      parentId: group.id,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 50,
        y: 0,
      },
    });

    editor.insertNodes([frame, group, image]);
    editor.setFocusedGroup(group.id);
    editor.select(image.id);

    expect(
      editor.getRasterTargetState({ point: { x: 80, y: 50 }, tool: "brush" })
    ).toMatchObject({ enabled: true, kind: "existing", nodeId: image.id });
    editor.setActiveTool("brush");
    editor
      .dispatchNodePointerDown({ node: image, point: { x: 80, y: 50 } })
      ?.cancel();
    expect(target?.writableBounds).toEqual({
      height: 100,
      width: 50,
      x: 0,
      y: 0,
    });

    editor.getState().updateNodeById(group.id, (node) => ({
      ...node,
      locked: true,
    }));

    expect(
      editor.getRasterTargetState({ point: { x: 80, y: 50 }, tool: "brush" })
    ).toEqual({ enabled: false, kind: "invalid" });
  });

  test("clips a Frame child target before Dab work", async () => {
    const recorder = createRasterOperationRecorder();
    let target: RasterTarget | null = null;
    const editor = new Editor({
      rasterSurface: {
        resolveSurface: (nextTarget: RasterTarget) => {
          target = structuredClone(nextTarget);
          return recorder;
        },
      },
    });
    const frame = createFrame("frame", { height: 100, width: 100 });
    const image = createImage("raster", {
      height: 100,
      parentId: frame.id,
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 50,
        y: 0,
      },
      width: 100,
    });

    editor.insertNodes([frame, image]);
    editor.select(image.id);
    editor.setActiveTool("brush");
    const session = editor.dispatchNodePointerDown({
      node: image,
      point: { x: -1_000_000, y: 50 },
    });

    session?.update({ point: { x: 1_000_000, y: 50 } });
    await session?.complete({ point: { x: 1_000_000, y: 50 } });

    expect(target).toMatchObject({
      bounds: { height: 100, width: 100, x: 0, y: 0 },
      writableBounds: { height: 100, width: 50, x: 0, y: 0 },
    });
    const dabs = recorder.commits[0]?.dabs || [];
    expect(dabs.length).toBeGreaterThan(0);
    expect(dabs.length).toBeLessThan(200);
    expect(dabs.every((dab) => dab.center.x >= -12 && dab.center.x <= 62)).toBe(
      true
    );
  });

  test("does not allocate for a rotated Raster gesture outside its Frame polygon", async () => {
    const recorder = createRasterOperationRecorder();
    const editor = new Editor({
      rasterSurface: {
        resolveSurface: () => recorder,
      },
    });
    const frame = createFrame("frame", { height: 100, width: 100 });
    const image = createImage("raster", {
      parentId: frame.id,
      transform: {
        rotation: 45,
        scaleX: 1,
        scaleY: 1,
        x: 50,
        y: 0,
      },
    });
    const outsideFramePoint = getNodeWorldPoint(image, getImageBounds(image), {
      x: 80,
      y: 0,
    });

    editor.insertNodes([frame, image]);
    editor.select(image.id);
    editor.setActiveTool("brush");
    await editor
      .dispatchNodePointerDown({ node: image, point: outsideFramePoint })
      ?.complete({ point: outsideFramePoint });

    expect(recorder.commits).toHaveLength(0);
  });
});

describe("Raster Crop", () => {
  test("committing an untouched oversized Raster is a no-op", () => {
    const editor = new Editor();
    const image = createImage("raster", {
      height: 10_000,
      width: 20_000,
    });

    editor.insertNodes([image]);
    editor.resetHistory();
    editor.select(image.id);

    expect(editor.startCrop()).toBe(true);
    expect(editor.commitCrop()).toBe(false);
    expect(editor.getNode(image.id)).toEqual(image);
    expect(editor.canUndo).toBe(false);
  });

  test("trims and re-expands retained pixels without moving them", () => {
    const editor = new Editor();
    const image = createImage("raster", {
      baseHeight: 80,
      baseWidth: 80,
      baseX: 10,
      baseY: 10,
      height: 100,
      transform: {
        rotation: 25,
        scaleX: 1.5,
        scaleY: 1.5,
        x: 200,
        y: 300,
      },
      width: 100,
    });

    editor.insertNodes([image]);
    editor.select(image.id);
    const beforePixelAnchor = getNodeWorldPoint(image, getImageBounds(image), {
      x: image.baseX,
      y: image.baseY,
    });

    expect(editor.startCrop()).toBe(true);
    editor.updateCrop({ height: 60, width: 70, x: 20, y: 15 });
    expect(editor.commitCrop()).toBe(true);

    const cropped = editor.getNode(image.id);
    expect(cropped).toMatchObject({
      baseHeight: 80,
      baseWidth: 80,
      baseX: -10,
      baseY: -5,
      height: 60,
      width: 70,
    });
    expect(cropped?.transform.rotation).toBe(25);
    expect(cropped?.transform.scaleX).toBe(1.5);
    expect(cropped?.transform.scaleY).toBe(1.5);
    const afterPixelAnchor = getNodeWorldPoint(
      cropped,
      getImageBounds(cropped),
      {
        x: cropped.baseX,
        y: cropped.baseY,
      }
    );
    expect(afterPixelAnchor.x).toBeCloseTo(beforePixelAnchor.x, 2);
    expect(afterPixelAnchor.y).toBeCloseTo(beforePixelAnchor.y, 2);

    expect(editor.startCrop()).toBe(true);
    editor.updateCrop({ height: 100, width: 120, x: -30, y: -20 });
    editor.commitCrop();

    expect(editor.getNode(image.id)).toMatchObject({
      baseHeight: 80,
      baseWidth: 80,
      baseX: 20,
      baseY: 15,
      height: 100,
      width: 120,
    });
  });

  test("Crop keeps tiled Raster pixels anchored with the base payload", () => {
    const editor = new Editor();
    const image = createImage("raster", {
      tileSources: [
        {
          col: 0,
          height: 20,
          ref: "tile",
          row: 0,
          src: "data:image/png;base64,tile",
          width: 20,
          x: 40,
          y: 30,
        },
      ],
    });

    editor.insertNodes([image]);
    editor.select(image.id);
    editor.startCrop();
    editor.updateCrop({ height: 80, width: 70, x: 15, y: 10 });
    editor.commitCrop();

    expect(editor.getNode(image.id)).toMatchObject({
      baseX: -15,
      baseY: -10,
      tileSources: [{ x: 25, y: 20 }],
    });
  });

  test("Crop preview is transient, cancel is exact, and commit is one history step", () => {
    const editor = new Editor();
    const image = createImage("raster");

    editor.insertNodes([image]);
    editor.resetHistory();
    editor.select(image.id);
    editor.startCrop();
    editor.updateCrop({ height: 150, width: 160, x: -30, y: -20 });

    expect(editor.getNode(image.id)).toEqual(image);
    expect(editor.cancelCrop()).toBe(true);
    expect(editor.getNode(image.id)).toEqual(image);
    expect(editor.canUndo).toBe(false);

    editor.startCrop();
    editor.updateCrop({ height: 150, width: 160, x: -30, y: -20 });
    expect(editor.commitCrop()).toBe(true);
    expect(editor.canUndo).toBe(true);
    expect(editor.undo()).toBe(true);
    expect(editor.getNode(image.id)).toEqual(image);
    expect(editor.canUndo).toBe(false);
  });

  test("Crop rejects a locked Raster", () => {
    const editor = new Editor();
    const image = createImage("raster", { locked: true });

    editor.insertNodes([image]);
    editor.select(image.id);

    expect(editor.startCrop()).toBe(false);
    expect(editor.rasterCropSession).toBeNull();
  });

  test("document replacement clears transient Crop state", () => {
    const editor = new Editor();
    const image = createImage("raster");

    editor.insertNodes([image]);
    editor.select(image.id);
    expect(editor.startCrop()).toBe(true);

    editor.getState().loadNodes([]);

    expect(editor.rasterCropSession).toBeNull();
    expect(editor.getRasterCropPreviewNode()).toBeNull();
  });

  test("Crop mode blocks destructive editor shortcuts", () => {
    const editor = new Editor();
    const image = createImage("raster");
    let prevented = false;

    editor.insertNodes([image]);
    editor.select(image.id);
    editor.startCrop();

    expect(
      editor.handleCanvasShortcutKeyDown(
        {
          altKey: false,
          code: "Delete",
          ctrlKey: false,
          metaKey: false,
          preventDefault: () => {
            prevented = true;
          },
          shiftKey: false,
        },
        "delete"
      )
    ).toBe(true);
    expect(prevented).toBe(true);
    expect(editor.getNode(image.id)).toEqual(image);
    expect(editor.rasterCropSession?.nodeId).toBe(image.id);
  });

  test("selection changes commit Crop before selecting another node", () => {
    const editor = new Editor();
    const image = createImage("raster");
    const other = createImage("other");

    editor.insertNodes([image, other]);
    editor.select(image.id);
    editor.startCrop();
    editor.updateCrop({ height: 80, width: 70, x: 10, y: 15 });

    editor.select(other.id);

    expect(editor.rasterCropSession).toBeNull();
    expect(editor.selectedNodeId).toBe(other.id);
    expect(editor.getNode(image.id)).toMatchObject({
      height: 80,
      width: 70,
    });
  });

  test("tool changes commit Crop before activating the next tool", () => {
    const editor = new Editor();
    const image = createImage("raster");

    editor.insertNodes([image]);
    editor.select(image.id);
    editor.startCrop();
    editor.updateCrop({ height: 80, width: 70, x: 10, y: 15 });

    editor.setActiveTool("brush");

    expect(editor.rasterCropSession).toBeNull();
    expect(editor.activeTool).toBe("brush");
    expect(editor.getNode(image.id)).toMatchObject({
      height: 80,
      width: 70,
    });
  });

  test("invalid Crop targets clear the transient session", () => {
    const editor = new Editor();
    const image = createImage("raster");

    editor.insertNodes([image]);
    editor.select(image.id);
    editor.startCrop();
    editor.deleteNode(image.id);

    expect(editor.commitCrop()).toBe(false);
    expect(editor.rasterCropSession).toBeNull();
  });

  test("Crop snapshots authoritative resident pixels", () => {
    const editor = new Editor({
      rasterSurface: {
        resolveSurface: () => null,
        snapshotSurface: () => ({
          height: 100,
          src: "data:image/png;base64,resident",
          width: 100,
        }),
      },
    });
    const image = createImage("raster");

    editor.insertNodes([image]);
    editor.resetHistory();
    editor.select(image.id);
    editor.startCrop();
    editor.updateCrop({ height: 80, width: 70, x: 20, y: 10 });
    editor.commitCrop();

    expect(editor.getNode(image.id)).toMatchObject({
      baseHeight: 100,
      baseWidth: 100,
      baseX: -20,
      baseY: -10,
      height: 80,
      src: "data:image/png;base64,resident",
      width: 70,
    });
    expect(editor.undo()).toBe(true);
    expect(editor.getNode(image.id)).toMatchObject({
      height: 100,
      src: "data:image/png;base64,resident",
      width: 100,
    });
  });

  test("SVG export clips retained Crop pixels to visible Raster bounds", async () => {
    const editor = new Editor();
    const image = createImage("raster", {
      baseHeight: 100,
      baseWidth: 100,
      baseX: -20,
      baseY: -10,
      height: 60,
      width: 70,
    });

    editor.insertNodes([image]);

    const svg = await editor.exportDocument();

    expect(svg).toContain(
      '<svg x="0" y="0" width="70" height="60" overflow="hidden">'
    );
    expect(svg).toContain(
      '<image href="data:image/png;base64,existing" x="-20" y="-10" width="100" height="100"'
    );
  });
});
