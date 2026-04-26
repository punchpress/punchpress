import { describe, expect, test } from "bun:test";
import { Editor, getDefaultWarp } from "@punchpress/engine";
import {
  createLocalFontDescriptor,
  getLocalFontId,
  MissingDocumentFontsError,
  PUNCH_DOCUMENT_VERSION,
} from "@punchpress/punch-schema";

const AVAILABLE_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;

const MISSING_FONT = {
  family: "Missing Font",
  fullName: "Missing Font",
  postscriptName: "MissingFont-Regular",
  style: "Regular",
} as const;

const createDocument = (
  id: string,
  text: string,
  font = MISSING_FONT,
  version = PUNCH_DOCUMENT_VERSION
) => {
  return JSON.stringify({
    nodes: [
      {
        fill: "#000000",
        fontSize: 120,
        font,
        id,
        parentId: "root",
        stroke: null,
        strokeWidth: 0,
        text,
        tracking: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 100,
          y: 200,
        },
        type: "text",
        visible: true,
        warp: {
          kind: "none",
        },
      },
    ],
    version,
  });
};

const createCircleDocument = (id: string, pathPosition?: number) => {
  return JSON.stringify({
    nodes: [
      {
        fill: "#000000",
        font: AVAILABLE_FONT,
        fontSize: 120,
        id,
        parentId: "root",
        stroke: null,
        strokeWidth: 0,
        text: "CIRCLE",
        tracking: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 100,
          y: 200,
        },
        type: "text",
        visible: true,
        warp: {
          kind: "circle",
          ...(pathPosition === undefined ? {} : { pathPosition }),
          radius: 900,
          sweepDeg: 140,
        },
      },
    ],
    version: "1.7",
  });
};

const createFakeLoadedFont = () => {
  return {
    charToGlyph: () => ({
      advanceWidth: 800,
      getPath: (_x: number, _y: number, fontSize: number) => {
        const scale = fontSize / 100;

        return {
          commands: [
            { type: "M", x: 0, y: -260 * scale },
            { type: "L", x: 50 * scale, y: -260 * scale },
            { type: "L", x: 50 * scale, y: 40 * scale },
            { type: "L", x: 0, y: 40 * scale },
            { type: "Z" },
          ],
          toPathData: () => "",
        };
      },
    }),
    unitsPerEm: 1000,
  };
};

const createRectangleSegments = () => {
  return [
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: -100, y: -60 },
      pointType: "corner" as const,
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: 100, y: -60 },
      pointType: "corner" as const,
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: 100, y: 60 },
      pointType: "corner" as const,
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: -100, y: 60 },
      pointType: "corner" as const,
    },
  ];
};

const rotatePointAround = (
  point: { x: number; y: number },
  center: { x: number; y: number },
  rotation: number
) => {
  const angle = (rotation * Math.PI) / 180;
  const offsetX = point.x - center.x;
  const offsetY = point.y - center.y;

  return {
    x: center.x + offsetX * Math.cos(angle) - offsetY * Math.sin(angle),
    y: center.y + offsetX * Math.sin(angle) + offsetY * Math.cos(angle),
  };
};

const ROTATE_TRANSFORM_REGEX = /rotate\((-?\d+(?:\.\d+)?)deg\)/;

describe("Editor.loadDocument", () => {
  test("replaces the current document and clears transient selection state", () => {
    const editor = new Editor();

    editor.loadDocument(createDocument("first-node", "FIRST", AVAILABLE_FONT));
    editor.select("first-node");
    editor.addTextNode({ x: 320, y: 240 });

    expect(editor.nodes).toHaveLength(2);
    expect(editor.selectedNodeIds.length).toBeGreaterThan(0);

    editor.loadDocument(
      createDocument("second-node", "SECOND", AVAILABLE_FONT)
    );

    expect(
      editor.nodes.map((node) => ({
        id: node.id,
        text: node.text,
      }))
    ).toEqual([
      {
        id: "second-node",
        text: "SECOND",
      },
    ]);
    expect(editor.getNode("first-node")).toBeNull();
    expect(editor.selectedNodeIds).toEqual([]);
    expect(editor.selectedNodeId).toBeNull();
  });

  test("replaces missing fonts with the resolved default font on import", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...AVAILABLE_FONT, id: "arialmt" }],
      state: "ready",
    });

    const resolution = editor.loadDocument(
      createDocument("missing-font-node", "TEST")
    );

    expect(resolution.missingFonts).toEqual([MISSING_FONT]);
    expect(resolution.replacementFont).toEqual(AVAILABLE_FONT);
    expect(editor.nodes[0]?.font).toEqual(AVAILABLE_FONT);
  });

  test("fills in the default circle path position when older documents omit it", () => {
    const editor = new Editor();

    editor.loadDocument(createCircleDocument("circle-node"));

    expect(editor.nodes[0]?.warp).toEqual({
      kind: "circle",
      pathPosition: 0,
      radius: 900,
      sweepDeg: 140,
    });
  });
});

describe("Editor.exportDocument", () => {
  test("throws a missing-font error before export when a node uses an unavailable font", async () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...AVAILABLE_FONT, id: "arialmt" }],
      state: "ready",
    });
    editor.getState().loadNodes([
      {
        fill: "#000000",
        font: MISSING_FONT,
        fontSize: 120,
        id: "missing-font-node",
        stroke: null,
        strokeWidth: 0,
        text: "TEST",
        tracking: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 100,
          y: 200,
        },
        type: "text",
        visible: true,
        warp: {
          kind: "none",
        },
      },
    ]);

    await expect(editor.exportDocument()).rejects.toThrow(
      MissingDocumentFontsError
    );
  });
});

describe("Editor.getSelectionFrameKey", () => {
  test("updates the selection frame key when selected text geometry changes", () => {
    const editor = new Editor();

    editor.loadDocument(createDocument("selected-node", "HEYHEYHEYHEY"));
    editor.select("selected-node");

    const beforeKey = editor.getSelectionFrameKey();

    editor.updateSelectedNode({ text: "HEY" });

    expect(editor.getSelectionFrameKey()).not.toBe(beforeKey);
  });
});

describe("Editor.getSelectionTransformFrame", () => {
  test("uses the rendered boolean compound center as the rotate anchor", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        id: "subtract-vector",
        name: "Subtract",
        parentId: "root",
        pathComposition: "subtract",
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 0,
          y: 0,
        },
        type: "vector",
        visible: true,
      },
      {
        closed: true,
        fill: "#ffffff",
        fillRule: "nonzero",
        id: "subtract-base",
        parentId: "subtract-vector",
        segments: createRectangleSegments(),
        stroke: null,
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeMiterLimit: 4,
        strokeWidth: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 200,
          y: 200,
        },
        type: "path",
        visible: true,
      },
      {
        closed: true,
        fill: "#ffffff",
        fillRule: "nonzero",
        id: "subtract-cutter",
        parentId: "subtract-vector",
        segments: createRectangleSegments(),
        stroke: null,
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeMiterLimit: 4,
        strokeWidth: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 300,
          y: 200,
        },
        type: "path",
        visible: true,
      },
    ]);

    editor.select("subtract-vector");

    const frame = editor.getSelectionTransformFrame(["subtract-vector"]);
    const frameCenter = frame?.bounds
      ? {
          x: frame.bounds.minX + frame.bounds.width / 2,
          y: frame.bounds.minY + frame.bounds.height / 2,
        }
      : null;
    const childBounds = editor.getSelectionBounds([
      "subtract-base",
      "subtract-cutter",
    ]);
    const childBoundsCenter = childBounds
      ? {
          x: childBounds.minX + childBounds.width / 2,
          y: childBounds.minY + childBounds.height / 2,
        }
      : null;
    const session = editor.beginRotateSelection({ nodeId: "subtract-vector" });

    expect(frameCenter).not.toBeNull();
    expect(childBoundsCenter).not.toBeNull();
    expect(session?.selectionCenter).not.toBeNull();
    expect(frameCenter?.x).not.toBeCloseTo(childBoundsCenter?.x || 0, 4);
    expect(session?.selectionCenter.x).toBeCloseTo(frameCenter?.x || 0, 4);
    expect(session?.selectionCenter.y).toBeCloseTo(frameCenter?.y || 0, 4);
  });

  test("keeps a rotated compound vector selection frame aligned to the rotated child paths", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        id: "compound-vector",
        name: "Compound",
        pathComposition: "compound-fill",
        parentId: "root",
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 0,
          y: 0,
        },
        type: "vector",
        visible: true,
      },
      {
        closed: true,
        fill: "#ffffff",
        fillRule: "nonzero",
        id: "compound-path-1",
        parentId: "compound-vector",
        segments: createRectangleSegments(),
        stroke: null,
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeMiterLimit: 4,
        strokeWidth: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 220,
          y: 40,
        },
        type: "path",
        visible: true,
      },
      {
        closed: true,
        fill: "#ffffff",
        fillRule: "nonzero",
        id: "compound-path-2",
        parentId: "compound-vector",
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: -40, y: -30 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 70, y: -30 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 70, y: 50 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: -40, y: 50 },
            pointType: "corner",
          },
        ],
        stroke: null,
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeMiterLimit: 4,
        strokeWidth: 0,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: -120,
          y: -20,
        },
        type: "path",
        visible: true,
      },
    ]);

    editor.select("compound-vector");
    editor.rotateSelectionBy({ deltaRotation: 30 });

    const frame = editor.getSelectionTransformFrame(["compound-vector"]);

    expect(frame?.transform).toBe("rotate(30deg)");

    const frameBounds = frame?.bounds;
    const frameCenter = frameBounds
      ? {
          x: frameBounds.minX + frameBounds.width / 2,
          y: frameBounds.minY + frameBounds.height / 2,
        }
      : null;

    expect(frameBounds).not.toBeNull();
    expect(frameCenter).not.toBeNull();

    for (const nodeId of ["compound-path-1", "compound-path-2"]) {
      const node = editor.getNode(nodeId);
      const bounds = editor.getNodeTransformBounds(nodeId);

      expect(node).not.toBeNull();
      expect(bounds).not.toBeNull();

      const localCenter = {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
      };
      const worldCenter = {
        x: node.transform.x + localCenter.x,
        y: node.transform.y + localCenter.y,
      };
      const localCorners = [
        { x: bounds.minX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.maxY },
        { x: bounds.minX, y: bounds.maxY },
      ];

      for (const corner of localCorners) {
        const worldCorner = rotatePointAround(
          {
            x: worldCenter.x + (corner.x - localCenter.x),
            y: worldCenter.y + (corner.y - localCenter.y),
          },
          worldCenter,
          node.transform.rotation
        );
        const unrotatedCorner = rotatePointAround(
          worldCorner,
          frameCenter,
          -30
        );

        expect(unrotatedCorner.x).toBeGreaterThanOrEqual(
          frameBounds.minX - 0.01
        );
        expect(unrotatedCorner.x).toBeLessThanOrEqual(frameBounds.maxX + 0.01);
        expect(unrotatedCorner.y).toBeGreaterThanOrEqual(
          frameBounds.minY - 0.01
        );
        expect(unrotatedCorner.y).toBeLessThanOrEqual(frameBounds.maxY + 0.01);
      }
    }
  });

  test("keeps a rotated multi-compound selection frame aligned to both compound vectors", () => {
    const editor = new Editor();

    const createCompoundVectorNodes = (
      vectorId: string,
      outerPathId: string,
      innerPathId: string,
      outerPosition: { x: number; y: number },
      innerPosition: { x: number; y: number }
    ) => {
      return [
        {
          id: vectorId,
          name: vectorId,
          pathComposition: "compound-fill",
          parentId: "root",
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 0,
            y: 0,
          },
          type: "vector",
          visible: true,
        },
        {
          closed: true,
          fill: "#ffffff",
          fillRule: "nonzero",
          id: outerPathId,
          parentId: vectorId,
          segments: createRectangleSegments(),
          stroke: null,
          strokeLineCap: "round",
          strokeLineJoin: "round",
          strokeMiterLimit: 4,
          strokeWidth: 0,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: outerPosition.x,
            y: outerPosition.y,
          },
          type: "path",
          visible: true,
        },
        {
          closed: true,
          fill: "#ffffff",
          fillRule: "nonzero",
          id: innerPathId,
          parentId: vectorId,
          segments: [
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -40, y: -30 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 70, y: -30 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 70, y: 50 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -40, y: 50 },
              pointType: "corner",
            },
          ],
          stroke: null,
          strokeLineCap: "round",
          strokeLineJoin: "round",
          strokeMiterLimit: 4,
          strokeWidth: 0,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: innerPosition.x,
            y: innerPosition.y,
          },
          type: "path",
          visible: true,
        },
      ];
    };

    editor
      .getState()
      .loadNodes([
        ...createCompoundVectorNodes(
          "compound-vector-a",
          "compound-a-path-1",
          "compound-a-path-2",
          { x: 220, y: 40 },
          { x: -120, y: -20 }
        ),
        ...createCompoundVectorNodes(
          "compound-vector-b",
          "compound-b-path-1",
          "compound-b-path-2",
          { x: 620, y: 360 },
          { x: 300, y: 300 }
        ),
      ]);

    editor.setSelectedNodes(["compound-vector-a", "compound-vector-b"]);
    editor.rotateSelectionBy({ deltaRotation: 30 });

    const frame = editor.getSelectionTransformFrame([
      "compound-vector-a",
      "compound-vector-b",
    ]);

    expect(frame?.transform).toBe("rotate(30deg)");

    const frameBounds = frame?.bounds;
    const frameCenter = frameBounds
      ? {
          x: frameBounds.minX + frameBounds.width / 2,
          y: frameBounds.minY + frameBounds.height / 2,
        }
      : null;

    expect(frameBounds).not.toBeNull();
    expect(frameCenter).not.toBeNull();

    for (const nodeId of [
      "compound-a-path-1",
      "compound-a-path-2",
      "compound-b-path-1",
      "compound-b-path-2",
    ]) {
      const node = editor.getNode(nodeId);
      const bounds = editor.getNodeTransformBounds(nodeId);

      expect(node).not.toBeNull();
      expect(bounds).not.toBeNull();

      const localCenter = {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
      };
      const worldCenter = {
        x: node.transform.x + localCenter.x,
        y: node.transform.y + localCenter.y,
      };
      const localCorners = [
        { x: bounds.minX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.maxY },
        { x: bounds.minX, y: bounds.maxY },
      ];

      for (const corner of localCorners) {
        const worldCorner = rotatePointAround(
          {
            x: worldCenter.x + (corner.x - localCenter.x),
            y: worldCenter.y + (corner.y - localCenter.y),
          },
          worldCenter,
          node.transform.rotation
        );
        const unrotatedCorner = rotatePointAround(
          worldCorner,
          frameCenter,
          -30
        );

        expect(unrotatedCorner.x).toBeGreaterThanOrEqual(
          frameBounds.minX - 0.01
        );
        expect(unrotatedCorner.x).toBeLessThanOrEqual(frameBounds.maxX + 0.01);
        expect(unrotatedCorner.y).toBeGreaterThanOrEqual(
          frameBounds.minY - 0.01
        );
        expect(unrotatedCorner.y).toBeLessThanOrEqual(frameBounds.maxY + 0.01);
      }
    }
  });

  test("keeps a rotated multi-compound selection frame when the compounds have slightly different rotations", () => {
    const editor = new Editor();

    const createCompoundVectorNodes = (
      vectorId: string,
      outerPathId: string,
      innerPathId: string,
      outerPosition: { x: number; y: number },
      innerPosition: { x: number; y: number },
      rotation: number
    ) => {
      return [
        {
          id: vectorId,
          name: vectorId,
          pathComposition: "compound-fill",
          parentId: "root",
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 0,
            y: 0,
          },
          type: "vector",
          visible: true,
        },
        {
          closed: true,
          fill: "#ffffff",
          fillRule: "nonzero",
          id: outerPathId,
          parentId: vectorId,
          segments: createRectangleSegments(),
          stroke: null,
          strokeLineCap: "round",
          strokeLineJoin: "round",
          strokeMiterLimit: 4,
          strokeWidth: 0,
          transform: {
            rotation,
            scaleX: 1,
            scaleY: 1,
            x: outerPosition.x,
            y: outerPosition.y,
          },
          type: "path",
          visible: true,
        },
        {
          closed: true,
          fill: "#ffffff",
          fillRule: "nonzero",
          id: innerPathId,
          parentId: vectorId,
          segments: [
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -40, y: -30 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 70, y: -30 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: 70, y: 50 },
              pointType: "corner",
            },
            {
              handleIn: { x: 0, y: 0 },
              handleOut: { x: 0, y: 0 },
              point: { x: -40, y: 50 },
              pointType: "corner",
            },
          ],
          stroke: null,
          strokeLineCap: "round",
          strokeLineJoin: "round",
          strokeMiterLimit: 4,
          strokeWidth: 0,
          transform: {
            rotation,
            scaleX: 1,
            scaleY: 1,
            x: innerPosition.x,
            y: innerPosition.y,
          },
          type: "path",
          visible: true,
        },
      ];
    };

    editor
      .getState()
      .loadNodes([
        ...createCompoundVectorNodes(
          "compound-vector-a",
          "compound-a-path-1",
          "compound-a-path-2",
          { x: 220, y: 40 },
          { x: -120, y: -20 },
          10
        ),
        ...createCompoundVectorNodes(
          "compound-vector-b",
          "compound-b-path-1",
          "compound-b-path-2",
          { x: 620, y: 360 },
          { x: 300, y: 300 },
          20
        ),
      ]);

    const frame = editor.getSelectionTransformFrame([
      "compound-vector-a",
      "compound-vector-b",
    ]);
    const frameRotation = Number.parseFloat(
      frame?.transform?.match(ROTATE_TRANSFORM_REGEX)?.[1] || "0"
    );

    expect(Math.abs(frameRotation)).toBeGreaterThan(8);

    const frameBounds = frame?.bounds;
    const frameCenter = frameBounds
      ? {
          x: frameBounds.minX + frameBounds.width / 2,
          y: frameBounds.minY + frameBounds.height / 2,
        }
      : null;

    expect(frameBounds).not.toBeNull();
    expect(frameCenter).not.toBeNull();

    for (const nodeId of [
      "compound-a-path-1",
      "compound-a-path-2",
      "compound-b-path-1",
      "compound-b-path-2",
    ]) {
      const node = editor.getNode(nodeId);
      const bounds = editor.getNodeTransformBounds(nodeId);

      expect(node).not.toBeNull();
      expect(bounds).not.toBeNull();

      const localCenter = {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
      };
      const worldCenter = {
        x: node.transform.x + localCenter.x,
        y: node.transform.y + localCenter.y,
      };
      const localCorners = [
        { x: bounds.minX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.maxY },
        { x: bounds.minX, y: bounds.maxY },
      ];

      for (const corner of localCorners) {
        const worldCorner = rotatePointAround(
          {
            x: worldCenter.x + (corner.x - localCenter.x),
            y: worldCenter.y + (corner.y - localCenter.y),
          },
          worldCenter,
          node.transform.rotation
        );
        const unrotatedCorner = rotatePointAround(
          worldCorner,
          frameCenter,
          -frameRotation
        );

        expect(unrotatedCorner.x).toBeGreaterThanOrEqual(
          frameBounds.minX - 0.01
        );
        expect(unrotatedCorner.x).toBeLessThanOrEqual(frameBounds.maxX + 0.01);
        expect(unrotatedCorner.y).toBeGreaterThanOrEqual(
          frameBounds.minY - 0.01
        );
        expect(unrotatedCorner.y).toBeLessThanOrEqual(frameBounds.maxY + 0.01);
      }
    }
  });
});

describe("Editor.getNodeTransformFrame", () => {
  test("uses the child path geometry for a selected vector container transform frame", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        id: "scaled-vector-node",
        parentId: "root",
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 0,
          y: 0,
        },
        type: "vector",
        visible: true,
      },
      {
        closed: true,
        fill: "#ffffff",
        fillRule: "nonzero",
        id: "scaled-vector-path",
        parentId: "scaled-vector-node",
        segments: createRectangleSegments(),
        stroke: null,
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeMiterLimit: 4,
        strokeWidth: 0,
        transform: {
          rotation: 30,
          scaleX: 2,
          scaleY: 0.5,
          x: 100,
          y: 200,
        },
        type: "path",
        visible: true,
      },
    ]);

    expect(editor.getNodeTransformFrame("scaled-vector-node")).toEqual({
      bounds: {
        height: 120,
        maxX: 200,
        maxY: 260,
        minX: 0,
        minY: 140,
        width: 200,
      },
      transform: undefined,
    });
  });

  test("uses the same overlay-frame normalization for scaled text nodes", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        fill: "#000000",
        font: AVAILABLE_FONT,
        fontSize: 120,
        id: "scaled-text-node",
        parentId: "root",
        stroke: null,
        strokeWidth: 0,
        text: "TEST",
        tracking: 0,
        transform: {
          rotation: 20,
          scaleX: 1.5,
          scaleY: 0.75,
          x: 100,
          y: 200,
        },
        type: "text",
        visible: true,
        warp: {
          kind: "none",
        },
      },
    ]);

    const frame = editor.getNodeTransformFrame("scaled-text-node");

    expect(frame?.transform).toBe("rotate(20deg)");
  });

  test("keeps rotated path overlay bounds stable instead of expanding the box", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        closed: true,
        fill: "#ffffff",
        fillRule: "nonzero",
        id: "scaled-path-node",
        parentId: "root",
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: -100, y: -60 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 100, y: -60 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 100, y: 60 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: -100, y: 60 },
            pointType: "corner",
          },
        ],
        stroke: null,
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeMiterLimit: 4,
        strokeWidth: 0,
        transform: {
          rotation: 30,
          scaleX: 2,
          scaleY: 0.5,
          x: 100,
          y: 200,
        },
        type: "path",
        visible: true,
      },
    ]);

    expect(editor.getNodeTransformFrame("scaled-path-node")).toEqual({
      bounds: {
        height: 60,
        maxX: 300,
        maxY: 230,
        minX: -100,
        minY: 170,
        width: 400,
      },
      transform: "rotate(30deg)",
    });
  });
});

describe("Editor vector resize behavior", () => {
  test("keeps path stroke width stable while resizing a selected vector container", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        id: "vector-resize-node",
        parentId: "root",
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 100,
          y: 200,
        },
        type: "vector",
        visible: true,
      },
      {
        closed: true,
        fill: "#ffffff",
        fillRule: "nonzero",
        id: "vector-resize-path",
        parentId: "vector-resize-node",
        segments: createRectangleSegments(),
        stroke: "#000000",
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeMiterLimit: 4,
        strokeWidth: 12,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 100,
          y: 200,
        },
        type: "path",
        visible: true,
      },
    ]);

    editor.select("vector-resize-node");
    editor.resizeSelectionFromCorner({
      corner: "se",
      scale: 1.5,
    });

    expect(editor.getNode("vector-resize-node")).toMatchObject({
      transform: {
        scaleX: 1,
        scaleY: 1,
      },
      type: "vector",
    });
    expect(editor.getNode("vector-resize-path")).toMatchObject({
      strokeWidth: 12,
      transform: {
        scaleX: 1.5,
        scaleY: 1.5,
      },
      type: "path",
    });
  });
});

describe("Editor text editing mode", () => {
  test("uses the updated default wave warp preset", () => {
    expect(getDefaultWarp("wave")).toEqual({
      amplitude: 24,
      cycles: 1,
      kind: "wave",
    });
  });

  test("uses the slant warp preset", () => {
    expect(getDefaultWarp("slant")).toEqual({
      kind: "slant",
      rise: -120,
    });
  });

  test("creates new text nodes without a default warp", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...AVAILABLE_FONT, id: "arialmt" }],
      state: "ready",
    });

    editor.addTextNode({ x: 320, y: 240 });

    expect(editor.selectedNode?.warp).toEqual({
      kind: "none",
    });
  });

  test("creates new text nodes with a balanced starter style", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...AVAILABLE_FONT, id: "arialmt" }],
      state: "ready",
    });

    editor.addTextNode({ x: 320, y: 240 });

    expect(editor.selectedNode).toMatchObject({
      fill: "#ffffff",
      fontSize: 100,
      stroke: "#000000",
      strokeWidth: 3,
      text: "YOUR TEXT",
      tracking: 10,
      type: "text",
      warp: {
        kind: "none",
      },
    });
  });

  test("centers new text nodes on the requested point", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...AVAILABLE_FONT, id: "arialmt" }],
      state: "ready",
    });

    const defaultFont = createLocalFontDescriptor(editor.getDefaultFont());
    editor.fonts.cache.set(getLocalFontId(defaultFont), {
      descriptor: defaultFont,
      font: createFakeLoadedFont(),
      status: "ready",
    });

    const point = { x: 320, y: 240 };

    editor.addTextNode(point);

    const frame = editor.selectedNodeId
      ? editor.getNodeRenderFrame(editor.selectedNodeId)
      : null;
    const centerX = frame ? (frame.bounds.minX + frame.bounds.maxX) / 2 : null;
    const centerY = frame ? (frame.bounds.minY + frame.bounds.maxY) / 2 : null;

    expect(frame).not.toBeNull();
    expect(centerX).toBeCloseTo(point.x, 2);
    expect(centerY).toBeCloseTo(point.y, 2);
  });

  test("switches back to the pointer tool when placing a text node", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...AVAILABLE_FONT, id: "arialmt" }],
      state: "ready",
    });

    editor.setActiveTool("text");
    editor.addTextNode({ x: 320, y: 240 });

    expect(editor.activeTool).toBe("pointer");
    expect(editor.editingNodeId).not.toBeNull();
    expect(editor.selectedNodeIds).toEqual([editor.editingNodeId]);
    expect(editor.selectedNode?.warp).toEqual({
      kind: "none",
    });
  });

  test("switches back to the pointer tool when placing a shape node", () => {
    const editor = new Editor();

    editor.setNextShapeKind("ellipse");
    editor.setActiveTool("shape");
    editor.addShapeNode({ x: 320, y: 240 });

    expect(editor.activeTool).toBe("pointer");
    expect(editor.editingNodeId).toBeNull();
    expect(editor.selectedNodeIds).toEqual([editor.selectedNodeId]);
    expect(editor.getNode(editor.selectedNodeId)).toMatchObject({
      shape: "ellipse",
      type: "shape",
    });
  });

  test("keeps the pen tool active while starting a path", () => {
    const editor = new Editor();

    editor.setActiveTool("pen");
    const session = editor.dispatchCanvasPointerDown({
      point: { x: 420, y: 180 },
    });

    expect(session).not.toBeNull();

    session?.complete({
      dragDistancePx: 0,
      point: { x: 420, y: 180 },
    });

    expect(editor.activeTool).toBe("pen");
    expect(editor.editingNodeId).toBeNull();
    expect(editor.selectedNodeIds).toEqual([editor.selectedNodeId]);
    expect(editor.getNode(editor.selectedNodeId)).toMatchObject({
      type: "path",
    });
    expect(editor.getNode(editor.selectedNodeId)?.parentId).toBe("root");
    expect(editor.getNode(editor.selectedNodeId)?.transform).toMatchObject({
      x: 420,
      y: 180,
    });
    expect(editor.pathEditingNodeId).toBe(editor.selectedNodeId);
  });

  test("places a default path with corner anchor points", () => {
    const editor = new Editor();

    editor.addVectorNode({ x: 420, y: 180 });

    const selectedPath = editor.selectedNode;

    expect(selectedPath).toMatchObject({
      parentId: "root",
      type: "path",
    });
    expect(selectedPath?.segments.map((segment) => segment.point)).toEqual([
      { x: -120, y: -90 },
      { x: 120, y: -90 },
      { x: 120, y: 90 },
      { x: -120, y: 90 },
    ]);
  });

  test("includes standalone path stroke width in the render frame", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        closed: true,
        fill: "#ffffff",
        fillRule: "nonzero",
        id: "stroke-path",
        parentId: "root",
        segments: createRectangleSegments(),
        stroke: "#000000",
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeMiterLimit: 4,
        strokeWidth: 54,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 320,
          y: 240,
        },
        type: "path",
        visible: true,
      },
    ]);

    expect(editor.getNodeRenderFrame("stroke-path")).toEqual({
      bounds: {
        height: 174,
        maxX: 447,
        maxY: 327,
        minX: 193,
        minY: 153,
        width: 254,
      },
      transform: undefined,
    });
  });

  test("keeps the pointer tool active when opening an existing text node for editing", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...AVAILABLE_FONT, id: "arialmt" }],
      state: "ready",
    });
    editor.loadDocument(createDocument("editing-node", "EDIT", AVAILABLE_FONT));
    editor.setActiveTool("text");

    editor.startEditing(editor.getNode("editing-node"));

    expect(editor.activeTool).toBe("pointer");
    expect(editor.editingNodeId).toBe("editing-node");
  });
});

describe("Editor shape export", () => {
  test("exports visible shape nodes without requiring fonts", async () => {
    const editor = new Editor();

    editor.setNextShapeKind("star");
    editor.addShapeNode({ x: 480, y: 360 });

    const svg = await editor.exportDocument();

    expect(svg).toContain("<path");
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain('"shape":"star"');
  });

  test("exports visible paths without requiring fonts", async () => {
    const editor = new Editor();

    editor.addVectorNode({ x: 480, y: 360 });

    const svg = await editor.exportDocument();

    expect(svg).toContain("<path");
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('"type":"path"');
  });

  test("exports open vector contours without fill", async () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        id: "open-vector-node",
        name: "Vector",
        parentId: "root",
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 0,
          y: 0,
        },
        type: "vector",
        visible: true,
      },
      {
        closed: false,
        fill: "#ffffff",
        fillRule: "nonzero",
        id: "open-vector-path",
        parentId: "open-vector-node",
        segments: [
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: -120, y: -90 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 120, y: -90 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: 120, y: 90 },
            pointType: "corner",
          },
          {
            handleIn: { x: 0, y: 0 },
            handleOut: { x: 0, y: 0 },
            point: { x: -120, y: 90 },
            pointType: "corner",
          },
        ],
        stroke: "#000000",
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeMiterLimit: 4,
        strokeWidth: 12,
        transform: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          x: 480,
          y: 360,
        },
        type: "path",
        visible: true,
      },
    ]);

    const svg = await editor.exportDocument();

    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="#000000"');
    expect(svg).toContain('"closed":false');
  });
});

describe("Editor.getDebugDump", () => {
  test("returns a normalized snapshot of document, node, and selection state", () => {
    const editor = new Editor();
    editor.applyLocalFontCatalog({
      error: "",
      fonts: [{ ...AVAILABLE_FONT, id: "arialmt" }],
      state: "ready",
    });
    editor.loadDocument(createDocument("debug-node", "DEBUG", AVAILABLE_FONT));
    editor.select("debug-node");

    const dump = editor.getDebugDump();

    expect(dump.bootstrap.fontCatalogState).toBe("ready");
    expect(dump.document.nodeCount).toBe(1);
    expect(dump.document.version).toBe(PUNCH_DOCUMENT_VERSION);
    expect(dump.nodes).toHaveLength(1);
    expect(dump.nodes[0]?.id).toBe("debug-node");
    expect(dump.nodes[0]?.text).toBe("DEBUG");
    expect(dump.nodes[0]?.transform).toEqual({
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 100,
      y: 200,
    });
    expect(dump.nodes[0]?.frame).not.toBeNull();
    expect(dump.selection.ids).toEqual(["debug-node"]);
    expect(dump.selection.primaryId).toBe("debug-node");
    expect(dump.selection.bounds?.minX).toBeCloseTo(
      dump.nodes[0]?.frame?.bounds.minX ?? 0,
      6
    );
    expect(dump.selection.bounds?.minY).toBeCloseTo(
      dump.nodes[0]?.frame?.bounds.minY ?? 0,
      6
    );
    expect(dump.selection.bounds?.maxX).toBeCloseTo(
      dump.nodes[0]?.frame?.bounds.maxX ?? 0,
      6
    );
    expect(dump.selection.bounds?.maxY).toBeCloseTo(
      dump.nodes[0]?.frame?.bounds.maxY ?? 0,
      6
    );
    expect(dump.selection.handleRects).toEqual({
      ne: null,
      nw: null,
      se: null,
      sw: null,
    });
  });

  test("does not finalize editing when producing the dump", () => {
    const editor = new Editor();
    editor.loadDocument(
      createDocument("editing-node", "ORIGINAL", AVAILABLE_FONT)
    );

    editor.startEditing(editor.getNode("editing-node"));
    editor.setEditingText("WORK IN PROGRESS");

    const dump = editor.getDebugDump();

    expect(editor.editingNodeId).toBe("editing-node");
    expect(dump.editing.nodeId).toBe("editing-node");
    expect(dump.editing.text).toBe("WORK IN PROGRESS");
    expect(JSON.parse(dump.document.serialized).nodes[0]?.text).toBe(
      "WORK IN PROGRESS"
    );
  });
});
