import { describe, expect, test } from "bun:test";
import { Editor, estimateBounds, getNodeWorldPoint } from "@punchpress/engine";
import { getLocalFontId } from "@punchpress/punch-schema";

const FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;
const TRANSLATE_X_PATTERN = /^translate\(([-\d.]+)/;

const createFakeLoadedFont = () => {
  return {
    charToGlyph: () => ({
      advanceWidth: 500,
      getPath: (_x: number, _y: number, fontSize: number) => {
        return {
          commands: [
            { type: "M", x: 0, y: -0.8 * fontSize },
            { type: "L", x: 40, y: -0.8 * fontSize },
            { type: "L", x: 40, y: 0.2 * fontSize },
            { type: "L", x: 0, y: 0.2 * fontSize },
            { type: "Z" },
          ],
          toPathData: () => "",
        };
      },
    }),
    unitsPerEm: 1000,
  };
};

const getTransformTranslateX = (transform?: string) => {
  const match = transform?.match(TRANSLATE_X_PATTERN);
  return match ? Number.parseFloat(match[1]) : null;
};

const getCirclePoint = (radius: number, angleDeg: number) => {
  const angleRad = (angleDeg * Math.PI) / 180;

  return {
    x: radius * Math.sin(angleRad),
    y: radius - radius * Math.cos(angleRad),
  };
};

const createCircleNode = () => {
  return {
    fill: "#000000",
    font: FONT,
    fontSize: 120,
    id: "circle-node",
    parentId: "root",
    stroke: null,
    strokeWidth: 0,
    text: "HEY",
    tracking: 0,
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 500,
      y: 600,
    },
    type: "text",
    visible: true,
    warp: {
      kind: "circle",
      pathPosition: 0,
      radius: 900,
      sweepDeg: 140,
    },
  } as const;
};

describe("Editor text circle path sessions", () => {
  test("slides text around the circle without changing the radius", () => {
    const editor = new Editor();
    const node = createCircleNode();

    editor.getState().loadNodes([node]);

    const bbox = estimateBounds(node);
    const startPoint = getNodeWorldPoint(node, bbox, { x: 0, y: 0 });
    const rightPoint = getNodeWorldPoint(node, bbox, { x: 900, y: 900 });
    const session = editor.beginTextPathEdit({
      mode: "position",
      nodeId: node.id,
      pointerCanvas: startPoint,
    });

    expect(session).not.toBeNull();

    editor.updateTextPathEdit(session, {
      pointerCanvas: rightPoint,
    });

    expect(editor.getNode(node.id)?.warp.pathPosition).toBeCloseTo(0.25, 2);
    expect(editor.getNode(node.id)?.warp.radius).toBe(900);
  });

  test("holding shift snaps circle text placement to 15 degree increments", () => {
    const editor = new Editor();
    const node = createCircleNode();

    editor.getState().loadNodes([node]);

    const bbox = estimateBounds(node);
    const startPoint = getNodeWorldPoint(node, bbox, { x: 0, y: 0 });
    const unsnappedLocalPoint = getCirclePoint(900, 68);
    const unsnappedPoint = getNodeWorldPoint(node, bbox, unsnappedLocalPoint);
    const session = editor.beginTextPathEdit({
      mode: "position",
      nodeId: node.id,
      pointerCanvas: startPoint,
    });

    expect(session).not.toBeNull();

    editor.updateTextPathEdit(session, {
      pointerCanvas: unsnappedPoint,
      shiftKey: true,
    });

    expect(editor.getNode(node.id)?.warp.pathPosition).toBeCloseTo(5 / 24, 4);
  });

  test("scales the circle radius with the regular resize flow", () => {
    const editor = new Editor();
    const node = createCircleNode();

    editor.getState().loadNodes([node]);
    editor.select(node.id);

    editor.resizeSelectionFromCorner({
      corner: "se",
      scale: 1.5,
    });

    expect(editor.getNode(node.id)?.fontSize).toBeCloseTo(180, 2);
    expect(editor.getNode(node.id)?.warp.radius).toBeCloseTo(1350, 2);
  });

  test("only uses full path bounds while path editing is active", () => {
    const editor = new Editor();
    const node = createCircleNode();
    const bbox = estimateBounds(node);
    const selectionBounds = {
      height: bbox.height + 420,
      maxX: bbox.maxX + 160,
      maxY: bbox.maxY + 260,
      minX: bbox.minX - 160,
      minY: bbox.minY - 160,
      width: bbox.width + 320,
    };

    editor.getState().loadNodes([node]);
    editor.geometry.getById = () => ({
      bbox,
      guide: { kind: "circle" },
      paths: [],
      ready: true,
      selectionBounds,
    });
    editor.select(node.id);

    const defaultFrame = editor.getNodeFrame(node.id);

    expect(defaultFrame?.bounds.height).toBeCloseTo(bbox.height ?? 0, 2);
    expect(defaultFrame?.bounds.height).toBeLessThan(selectionBounds.height);

    editor.registerNodeTransformElement(node.id, {});

    const pathEditFrame = editor.getNodeFrame(node.id);

    expect(pathEditFrame?.bounds.height).toBeCloseTo(selectionBounds.height, 2);
  });

  test("can flip circle text to the inside without reversing the path order", () => {
    const editor = new Editor();
    const outsideNode = {
      ...createCircleNode(),
      text: "YOUR TEXT",
      warp: {
        ...createCircleNode().warp,
        pathPosition: 0.5,
      },
    };
    const insideNode = {
      ...outsideNode,
      id: "inside-circle-node",
      warp: {
        ...outsideNode.warp,
        inverted: true,
      },
    };

    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...FONT, id: "arialmt" }],
      state: "ready",
    });
    editor.fonts.cache.set(getLocalFontId(FONT), {
      descriptor: FONT,
      font: createFakeLoadedFont(),
      status: "ready",
    });
    editor.getState().loadNodes([outsideNode, insideNode]);

    const outsideGeometry = editor.getNodeGeometry(outsideNode.id);
    const insideGeometry = editor.getNodeGeometry(insideNode.id);
    const outsideFirstX = getTransformTranslateX(
      outsideGeometry?.paths[0]?.transform
    );
    const outsideLastX = getTransformTranslateX(
      outsideGeometry?.paths.at(-1)?.transform
    );
    const insideFirstX = getTransformTranslateX(
      insideGeometry?.paths[0]?.transform
    );
    const insideLastX = getTransformTranslateX(
      insideGeometry?.paths.at(-1)?.transform
    );

    expect(outsideFirstX).not.toBeNull();
    expect(outsideLastX).not.toBeNull();
    expect(insideFirstX).not.toBeNull();
    expect(insideLastX).not.toBeNull();
    expect((outsideFirstX ?? 0) > (outsideLastX ?? 0)).toBe(true);
    expect((insideFirstX ?? 0) < (insideLastX ?? 0)).toBe(true);
    expect(insideGeometry?.paths[0]?.d).toBe(outsideGeometry?.paths[0]?.d);
    expect(insideGeometry?.bbox.maxY ?? 0).toBeLessThan(
      outsideGeometry?.bbox.maxY ?? 0
    );
    expect(insideGeometry?.bbox.height ?? 0).toBeLessThan(
      outsideGeometry?.bbox.height ?? 0
    );
  });
});
