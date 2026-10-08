import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const solid = (id, color, opacity = 1) => ({
  enabled: true,
  id,
  opacity,
  paint: { color, kind: "solid" },
});

const strokeLayer = (id, width, extra = {}) => ({
  ...solid(id, "#000000"),
  align: "center",
  cap: "butt",
  join: "miter",
  miterLimit: 4,
  width,
  ...extra,
});

const filled = (color) => ({ fills: [solid("fill", color)], strokes: [] });

// An L shape: the middle of its bounds is empty (off-ink).
const createLShapeNode = (id, parentId = "root") => {
  return {
    appearance: filled("#ff0000"),
    closed: true,
    fillRule: "nonzero",
    id,
    parentId,
    segments: [
      { x: -100, y: -100 },
      { x: 100, y: -100 },
      { x: 100, y: -80 },
      { x: -80, y: -80 },
      { x: -80, y: 100 },
      { x: -100, y: 100 },
    ].map((point) => ({
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point,
      pointType: "corner",
    })),
    transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 300, y: 300 },
    type: "path",
    visible: true,
  };
};

const createSquareNode = (id, x, y, parentId = "root") => {
  return {
    appearance: filled("#0000ff"),
    closed: true,
    fillRule: "nonzero",
    id,
    parentId,
    segments: [
      { x: -20, y: -20 },
      { x: 20, y: -20 },
      { x: 20, y: 20 },
      { x: -20, y: 20 },
    ].map((point) => ({
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point,
      pointType: "corner",
    })),
    transform: { rotation: 0, scaleX: 1, scaleY: 1, x, y },
    type: "path",
    visible: true,
  };
};

const createGroupNode = (id) => {
  return {
    id,
    name: "Group",
    parentId: "root",
    transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
    type: "group",
    visible: true,
  };
};

const L_EMPTY_CENTER = { x: 300, y: 300 };
const L_INK = { x: 210, y: 300 };
const INSIDE_EMPTY = { x: 260, y: 260 };

const createEditor = (nodes) => {
  const editor = new Editor();

  editor.getState().loadNodes(nodes);
  return editor;
};

describe("presses inside an existing selection", () => {
  test("an off-ink press inside a selected node's bounds drags it", () => {
    const editor = createEditor([createLShapeNode("shape")]);

    editor.select("shape");

    expect(editor.hitTestNodePoint("shape", L_EMPTY_CENTER)).toBe(false);
    expect(editor.getSelectionPressIntent(L_EMPTY_CENTER)).toBe("drag");
    expect(editor.getSelectionPressIntent(L_INK)).toBe("drag");
  });

  test("clicking empty space inside the selection bounds keeps the selection", () => {
    const editor = createEditor([createLShapeNode("shape")]);

    editor.select("shape");
    editor.clickInsideSelection(L_EMPTY_CENTER);

    expect(editor.selectedNodeIds).toEqual(["shape"]);
  });

  test("clicking a smaller unselected object on top selects it", () => {
    const editor = createEditor([
      createLShapeNode("shape"),
      createSquareNode("top", 300, 300),
    ]);

    editor.select("shape");
    // Dragging from the top object still moves the existing selection.
    expect(editor.getSelectionPressIntent(L_EMPTY_CENTER)).toBe("drag");

    editor.clickInsideSelection(L_EMPTY_CENTER);

    expect(editor.selectedNodeIds).toEqual(["top"]);
  });

  test("an object below the selected ink does not steal the click", () => {
    const editor = createEditor([
      createSquareNode("below", 210, 300),
      createLShapeNode("shape"),
    ]);

    editor.select("shape");
    editor.clickInsideSelection(L_INK);

    expect(editor.selectedNodeIds).toEqual(["shape"]);
  });

  test("artwork clipped away by its frame does not take the click", () => {
    const editor = createEditor([
      {
        background: "#ffffff",
        height: 100,
        id: "frame",
        locked: false,
        name: "Frame",
        parentId: "root",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "artboard",
        visible: true,
        width: 100,
      },
      createLShapeNode("shape"),
      // Larger than its frame; only the part inside (0,0)-(100,100) paints.
      {
        ...createSquareNode("clipped", 300, 300, "frame"),
        transform: { rotation: 0, scaleX: 10, scaleY: 10, x: 300, y: 300 },
      },
    ]);

    editor.select("shape");
    editor.clickInsideSelection(L_EMPTY_CENTER);

    expect(editor.selectedNodeIds).toEqual(["shape"]);
  });

  test("clicks pass through a boolean cutout to the artwork below", () => {
    const scaled = (node, scale) => ({
      ...node,
      transform: { ...node.transform, scaleX: scale, scaleY: scale },
    });
    const editor = createEditor([
      scaled(createSquareNode("below", 300, 300), 4),
      {
        id: "compound",
        name: "Compound",
        parentId: "root",
        pathComposition: "subtract",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "vector",
        visible: true,
      },
      scaled(createSquareNode("compound-outer", 300, 300, "compound"), 3),
      scaled(createSquareNode("compound-cutout", 300, 300, "compound"), 1),
    ]);

    editor.select("below");
    editor.clickInsideSelection({ x: 300, y: 300 });
    expect(editor.selectedNodeIds).toEqual(["below"]);

    editor.clickInsideSelection({ x: 245, y: 300 });
    expect(editor.selectedNodeIds).toEqual(["compound"]);
  });

  test("clicks pass through an even-odd compound fill hole", () => {
    const scaled = (node, scale) => ({
      ...node,
      fillRule: "evenodd",
      transform: { ...node.transform, scaleX: scale, scaleY: scale },
    });
    const editor = createEditor([
      scaled(createSquareNode("below", 300, 300), 4),
      {
        id: "compound",
        name: "Compound",
        parentId: "root",
        pathComposition: "compound-fill",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "vector",
        visible: true,
      },
      scaled(createSquareNode("compound-outer", 300, 300, "compound"), 3),
      scaled(createSquareNode("compound-hole", 300, 300, "compound"), 1),
    ]);

    editor.select("below");
    editor.clickInsideSelection({ x: 300, y: 300 });
    expect(editor.selectedNodeIds).toEqual(["below"]);

    editor.clickInsideSelection({ x: 245, y: 300 });
    expect(editor.selectedNodeIds).toEqual(["compound"]);
  });

  test.each([
    "no fills",
    "a hidden fill",
    "a 0% fill",
  ])("a stroke-only boolean result (%s) takes clicks only on its stroke", (fillCase) => {
    const fills = {
      "a 0% fill": [solid("fill", "#ff0000", 0)],
      "a hidden fill": [{ ...solid("fill", "#ff0000"), enabled: false }],
      "no fills": [],
    }[fillCase];
    const outlined = (node, scale) => ({
      ...node,
      appearance: { fills, strokes: [strokeLayer("stroke", 10)] },
      transform: { ...node.transform, scaleX: scale, scaleY: scale },
    });
    const editor = createEditor([
      {
        ...createSquareNode("below", 300, 300),
        transform: { rotation: 0, scaleX: 4, scaleY: 4, x: 300, y: 300 },
      },
      {
        id: "outline",
        name: "Outline",
        parentId: "root",
        pathComposition: "unite",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "vector",
        visible: true,
      },
      outlined(createSquareNode("outline-a", 280, 300, "outline"), 2),
      outlined(createSquareNode("outline-b", 320, 300, "outline"), 2),
    ]);

    editor.select("below");
    editor.clickInsideSelection({ x: 300, y: 300 });
    expect(editor.selectedNodeIds).toEqual(["below"]);

    // Left edge of the united outline sits at x = 240.
    editor.clickInsideSelection({ x: 242, y: 300 });
    expect(editor.selectedNodeIds).toEqual(["outline"]);
  });

  test("inside a drilled group, clicks resolve vector children like normal targeting", () => {
    const editor = createEditor([
      {
        ...createSquareNode("below", 300, 300),
        transform: { rotation: 0, scaleX: 4, scaleY: 4, x: 300, y: 300 },
      },
      createGroupNode("group"),
      {
        id: "vector",
        name: "Vector",
        parentId: "group",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "vector",
        visible: true,
      },
      createSquareNode("vector-path", 300, 300, "vector"),
    ]);

    editor.select("below");
    editor.setFocusedGroup("group");
    const expectedTargetId = editor.getSelectionTargetNodeId("vector-path");

    expect(expectedTargetId).not.toBe(
      editor.getSelectionTargetNodeId("vector")
    );

    editor.clickInsideSelection({ x: 300, y: 300 });

    expect(editor.selectedNodeIds).toEqual([expectedTargetId]);
  });

  test("a drilled group does not open cutouts in unrelated vectors", () => {
    const scaled = (node, scale) => ({
      ...node,
      transform: { ...node.transform, scaleX: scale, scaleY: scale },
    });
    const editor = createEditor([
      createGroupNode("group"),
      scaled(createSquareNode("group-child", 300, 300, "group"), 4),
      createSquareNode("group-other", 600, 600, "group"),
      {
        id: "compound",
        name: "Compound",
        parentId: "root",
        pathComposition: "subtract",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "vector",
        visible: true,
      },
      scaled(createSquareNode("compound-outer", 300, 300, "compound"), 3),
      scaled(createSquareNode("compound-cutout", 300, 300, "compound"), 1),
    ]);

    editor.setFocusedGroup("group");
    editor.select("group-child");
    expect(editor.focusedGroupId).toBe("group");

    editor.clickInsideSelection({ x: 300, y: 300 });

    expect(editor.selectedNodeIds).toEqual(["group-child"]);
    expect(editor.focusedGroupId).toBe("group");
  });

  test("an empty boolean result does not take clicks", () => {
    const editor = createEditor([
      {
        ...createSquareNode("below", 300, 300),
        transform: { rotation: 0, scaleX: 4, scaleY: 4, x: 300, y: 300 },
      },
      {
        id: "empty",
        name: "Empty",
        parentId: "root",
        pathComposition: "intersect",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "vector",
        visible: true,
      },
      createSquareNode("empty-a", 250, 300, "empty"),
      createSquareNode("empty-b", 350, 300, "empty"),
    ]);

    editor.select("below");
    editor.clickInsideSelection({ x: 250, y: 300 });

    expect(editor.selectedNodeIds).toEqual(["below"]);
  });

  test("click-through follows canonical paint order across frames", () => {
    const editor = createEditor([
      {
        background: "#ffffff",
        height: 600,
        id: "frame",
        locked: false,
        name: "Frame",
        parentId: "root",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "artboard",
        visible: true,
        width: 600,
      },
      createLShapeNode("shape"),
      // Group contiguity moves the frame's child up into the frame's subtree,
      // so it paints below the later root-level shape.
      createSquareNode("frame-child", L_INK.x, L_INK.y, "frame"),
      createSquareNode("top", 300, 300),
    ]);

    editor.select("top");
    editor.clickInsideSelection(L_INK);
    expect(editor.selectedNodeIds).toEqual(["shape"]);

    editor.select("top");
    editor.clickInsideSelection({ x: 300, y: 300 });
    expect(editor.selectedNodeIds).toEqual(["top"]);
  });

  test("shift-click toggles the clicked object in the selection", () => {
    const editor = createEditor([
      createLShapeNode("shape"),
      createSquareNode("top", 300, 300),
    ]);

    editor.select("shape");
    editor.clickInsideSelection(L_EMPTY_CENTER, { shiftKey: true });

    expect(editor.selectedNodeIds).toEqual(["shape", "top"]);

    editor.clickInsideSelection(L_INK, { shiftKey: true });

    expect(editor.selectedNodeIds).toEqual(["top"]);
  });

  test("shift-click on empty space inside the bounds keeps the selection", () => {
    const editor = createEditor([createLShapeNode("shape")]);

    editor.select("shape");
    editor.clickInsideSelection(INSIDE_EMPTY, { shiftKey: true });

    expect(editor.selectedNodeIds).toEqual(["shape"]);
  });

  test("clicking one member of a multi-selection selects only that member", () => {
    const editor = createEditor([
      createSquareNode("left", 100, 100),
      createSquareNode("right", 400, 400),
    ]);

    editor.setSelectedNodes(["left", "right"]);
    expect(editor.getSelectionPressIntent({ x: 250, y: 250 })).toBe("drag");

    editor.clickInsideSelection({ x: 250, y: 250 });
    expect(editor.selectedNodeIds).toEqual(["left", "right"]);

    editor.clickInsideSelection({ x: 100, y: 100 });
    expect(editor.selectedNodeIds).toEqual(["left"]);
  });

  test("clicking a selected group's child keeps the group selected", () => {
    const editor = createEditor([
      createGroupNode("group"),
      createSquareNode("child-a", 100, 100, "group"),
      createSquareNode("child-b", 400, 400, "group"),
    ]);

    editor.select("group");
    expect(editor.getSelectionPressIntent({ x: 250, y: 250 })).toBe("drag");

    editor.clickInsideSelection({ x: 100, y: 100 });

    expect(editor.selectedNodeIds).toEqual(["group"]);
  });

  test("path editing keeps ink-only presses and exits on empty space", () => {
    const editor = createEditor([createLShapeNode("shape")]);

    editor.select("shape");
    editor.startPathEditing("shape");

    expect(editor.getSelectionPressIntent(L_INK)).toBe("drag");
    expect(editor.getSelectionPressIntent(L_EMPTY_CENTER)).toBe(
      "exit-path-editing"
    );
  });
});

describe("click-through follows visible appearance", () => {
  // A big selected square below, and a 40 × 40 square on top at (300, 300)
  // whose appearance decides whether the click reaches it.
  const clickOnTop = (appearance, point, topExtra = {}, extraNodes = []) => {
    const editor = createEditor([
      {
        ...createSquareNode("below", 300, 300),
        transform: { rotation: 0, scaleX: 6, scaleY: 6, x: 300, y: 300 },
      },
      ...extraNodes,
      { ...createSquareNode("top", 300, 300), appearance, ...topExtra },
    ]);

    editor.select("below");
    editor.clickInsideSelection(point);

    return editor.selectedNodeIds[0];
  };

  const CENTER = { x: 300, y: 300 };
  // The square's right edge sits at x = 320.
  const outsideBy = (distance) => ({ x: 320 + distance, y: 300 });
  const insideBy = (distance) => ({ x: 320 - distance, y: 300 });

  test("a 0% fill passes clicks through; a stroke still takes its band", () => {
    const appearance = {
      fills: [solid("fill", "#ff0000", 0)],
      strokes: [strokeLayer("stroke", 4)],
    };

    expect(clickOnTop(appearance, CENTER)).toBe("below");
    expect(clickOnTop(appearance, insideBy(1))).toBe("top");
  });

  test("a 0% stroke adds no reach to a visible fill", () => {
    const appearance = {
      fills: [solid("fill", "#ff0000")],
      strokes: [
        { ...strokeLayer("stroke", 30, { align: "outside" }), opacity: 0 },
      ],
    };

    expect(clickOnTop(appearance, CENTER)).toBe("top");
    expect(clickOnTop(appearance, outsideBy(20))).toBe("below");
  });

  test("an outside stroke reaches out, not in", () => {
    const appearance = {
      fills: [],
      strokes: [strokeLayer("stroke", 20, { align: "outside" })],
    };

    expect(clickOnTop(appearance, outsideBy(15))).toBe("top");
    expect(clickOnTop(appearance, insideBy(10))).toBe("below");
  });

  test("an inside stroke reaches in, not out", () => {
    const appearance = {
      fills: [],
      strokes: [strokeLayer("stroke", 10, { align: "inside" })],
    };

    expect(clickOnTop(appearance, insideBy(8))).toBe("top");
    expect(clickOnTop(appearance, outsideBy(8))).toBe("below");
    expect(clickOnTop(appearance, CENTER)).toBe("below");
  });

  test("a fully transparent gradient paints nothing; a partly visible one does", () => {
    const gradient = (opacities) => ({
      enabled: true,
      id: "fill",
      opacity: 1,
      paint: {
        end: { x: 1, y: 0 },
        kind: "linear-gradient",
        start: { x: 0, y: 0 },
        stops: opacities.map((opacity, index) => ({
          color: "#ff0000",
          id: `stop-${index}`,
          offset: index,
          opacity,
        })),
      },
    });

    expect(clickOnTop({ fills: [gradient([0, 0])], strokes: [] }, CENTER)).toBe(
      "below"
    );
    expect(
      clickOnTop({ fills: [gradient([0, 0.5])], strokes: [] }, CENTER)
    ).toBe("top");
  });

  test("a 0% object or a 0% isolated group paints nothing", () => {
    const appearance = filled("#00ff00");

    expect(clickOnTop(appearance, CENTER, { opacity: 0 })).toBe("below");
    expect(
      clickOnTop(appearance, CENTER, { parentId: "group" }, [
        { ...createGroupNode("group"), opacity: 0 },
      ])
    ).toBe("below");
    expect(
      clickOnTop(appearance, CENTER, { parentId: "group" }, [
        { ...createGroupNode("group"), opacity: 0.5 },
      ])
    ).toBe("group");
  });

  test("a boolean result with an outside stroke takes its outer ring only", () => {
    const outlined = (node) => ({
      ...node,
      appearance: {
        fills: [],
        strokes: [strokeLayer("stroke", 10, { align: "outside" })],
      },
    });
    const editor = createEditor([
      {
        ...createSquareNode("below", 300, 300),
        transform: { rotation: 0, scaleX: 6, scaleY: 6, x: 300, y: 300 },
      },
      {
        id: "outline",
        name: "Outline",
        parentId: "root",
        pathComposition: "unite",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "vector",
        visible: true,
      },
      outlined(createSquareNode("outline-a", 290, 300, "outline")),
      outlined(createSquareNode("outline-b", 310, 300, "outline")),
    ]);

    // The united result spans x 270..330.
    editor.select("below");
    editor.clickInsideSelection({ x: 274, y: 300 });
    expect(editor.selectedNodeIds).toEqual(["below"]);

    editor.clickInsideSelection({ x: 262, y: 300 });
    expect(editor.selectedNodeIds).toEqual(["outline"]);
  });

  test("a zero-length gradient paints only its last stop", () => {
    const zeroLength = (lastOpacity) => ({
      fills: [
        {
          enabled: true,
          id: "fill",
          opacity: 1,
          paint: {
            end: { x: 0.5, y: 0.5 },
            kind: "linear-gradient",
            start: { x: 0.5, y: 0.5 },
            stops: [
              { color: "#ff0000", id: "a", offset: 0, opacity: 1 },
              { color: "#ff0000", id: "b", offset: 1, opacity: lastOpacity },
            ],
          },
        },
      ],
      strokes: [],
    });

    expect(clickOnTop(zeroLength(0), CENTER)).toBe("below");
    expect(clickOnTop(zeroLength(1), CENTER)).toBe("top");
  });

  test("a boolean result whose style child is 0% paints nothing", () => {
    const editor = createEditor([
      {
        ...createSquareNode("below", 300, 300),
        transform: { rotation: 0, scaleX: 6, scaleY: 6, x: 300, y: 300 },
      },
      {
        id: "united",
        name: "United",
        parentId: "root",
        pathComposition: "unite",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "vector",
        visible: true,
      },
      createSquareNode("united-a", 290, 300, "united"),
      { ...createSquareNode("united-b", 310, 300, "united"), opacity: 0 },
    ]);

    editor.select("below");
    editor.clickInsideSelection({ x: 300, y: 300 });
    expect(editor.selectedNodeIds).toEqual(["below"]);
  });
});
