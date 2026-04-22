import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const ROTATE_TRANSFORM_REGEX = /rotate\((-?\d+(?:\.\d+)?)deg\)/;

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

const createPathNode = (
  id: string,
  parentId: string,
  position: { x: number; y: number },
  points: Array<{ x: number; y: number }>
) => ({
  closed: true,
  fill: "#ffffff",
  fillRule: "nonzero" as const,
  id,
  parentId,
  segments: points.map((point) => ({
    handleIn: { x: 0, y: 0 },
    handleOut: { x: 0, y: 0 },
    point,
    pointType: "corner" as const,
  })),
  stroke: "#000000",
  strokeLineCap: "round" as const,
  strokeLineJoin: "round" as const,
  strokeMiterLimit: 4,
  strokeWidth: 3,
  transform: {
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    x: position.x,
    y: position.y,
  },
  type: "path" as const,
  visible: true,
});

describe("Editor.getSelectionTransformFrame", () => {
  test("uses rendered boolean compound geometry for a rotated multi-selection frame", () => {
    const editor = new Editor();

    editor.getState().loadNodes([
      {
        id: "compound-a",
        name: "Compound A",
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
      createPathNode("compound-a-path-1", "compound-a", { x: 280, y: 260 }, [
        { x: -110, y: -90 },
        { x: 110, y: -90 },
        { x: 110, y: 110 },
        { x: -110, y: 110 },
      ]),
      createPathNode("compound-a-path-2", "compound-a", { x: 330, y: 310 }, [
        { x: -35, y: -180 },
        { x: 35, y: -180 },
        { x: 55, y: 40 },
        { x: -55, y: 40 },
      ]),
      {
        id: "compound-b",
        name: "Compound B",
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
      createPathNode("compound-b-path-1", "compound-b", { x: 560, y: 320 }, [
        { x: -120, y: -80 },
        { x: 120, y: -80 },
        { x: 120, y: 120 },
        { x: -120, y: 120 },
      ]),
      createPathNode("compound-b-path-2", "compound-b", { x: 620, y: 350 }, [
        { x: -45, y: -170 },
        { x: 45, y: -170 },
        { x: 70, y: 30 },
        { x: -70, y: 30 },
      ]),
    ]);

    editor.setSelectedNodes(["compound-a", "compound-b"]);
    editor.rotateSelectionBy({ deltaRotation: 28 });

    const frame = editor.getSelectionTransformFrame([
      "compound-a",
      "compound-b",
    ]);
    const frameRotation = Number.parseFloat(
      frame?.transform?.match(ROTATE_TRANSFORM_REGEX)?.[1] || "0"
    );
    const frameBounds = frame?.bounds;

    expect(frameBounds).not.toBeNull();
    expect(Math.abs(frameRotation)).toBeGreaterThan(20);

    if (!frameBounds) {
      return;
    }

    const frameCenter = {
      x: frameBounds.minX + frameBounds.width / 2,
      y: frameBounds.minY + frameBounds.height / 2,
    };
    const renderedPoints = [
      ...(editor.getNodeRenderGeometry("compound-a")?.selectionPoints || []),
      ...(editor.getNodeRenderGeometry("compound-b")?.selectionPoints || []),
    ];
    const unrotatedRenderedPoints = renderedPoints.map((point) => {
      return rotatePointAround(point, frameCenter, -frameRotation);
    });
    const renderedBounds = {
      maxX: Math.max(...unrotatedRenderedPoints.map((point) => point.x)),
      maxY: Math.max(...unrotatedRenderedPoints.map((point) => point.y)),
      minX: Math.min(...unrotatedRenderedPoints.map((point) => point.x)),
      minY: Math.min(...unrotatedRenderedPoints.map((point) => point.y)),
    };

    expect(Math.abs(frameBounds.minX - renderedBounds.minX)).toBeLessThan(8);
    expect(Math.abs(frameBounds.maxX - renderedBounds.maxX)).toBeLessThan(8);
    expect(Math.abs(frameBounds.minY - renderedBounds.minY)).toBeLessThan(8);
    expect(Math.abs(frameBounds.maxY - renderedBounds.maxY)).toBeLessThan(8);
  });
});
