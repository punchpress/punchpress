import { describe, expect, test } from "bun:test";
import { Editor } from "@punchpress/engine";

const ARIAL_FONT = {
  family: "Arial",
  fullName: "Arial",
  postscriptName: "ArialMT",
  style: "Regular",
} as const;

describe("Editor.rotateSelectionBy", () => {
  test("rotates a selected text node around its center", () => {
    const editor = createEditor();
    const nodeId = createTextNode(editor, {
      text: "Rotate me",
      x: 600,
      y: 450,
    });

    const beforeDump = editor.getDebugDump();
    const beforeNode = getDebugNode(beforeDump, nodeId);
    const beforeCenter = getFrameCenter(beforeNode);

    const rotatedNodeIds = editor.rotateSelectionBy({ deltaRotation: 30 });

    const afterDump = editor.getDebugDump();
    const afterNode = getDebugNode(afterDump, nodeId);
    const afterCenter = getFrameCenter(afterNode);

    expect(rotatedNodeIds).toEqual([nodeId]);
    expect(afterDump.selection.primaryId).toBe(nodeId);
    expect(
      afterNode.transform.rotation - beforeNode.transform.rotation
    ).toBeCloseTo(30, 6);
    expect(afterCenter.x).toBeCloseTo(beforeCenter.x, 6);
    expect(afterCenter.y).toBeCloseTo(beforeCenter.y, 6);
  });

  test("rotates a selected group around the shared selection center", () => {
    const editor = createEditor();
    const firstNodeId = createTextNode(editor, {
      text: "Rotate first",
      x: 520,
      y: 320,
    });
    const secondNodeId = createTextNode(editor, {
      text: "Rotate second",
      x: 760,
      y: 520,
    });

    editor.setSelectedNodes([firstNodeId, secondNodeId]);

    const beforeDump = editor.getDebugDump();
    const beforeFirst = getDebugNode(beforeDump, firstNodeId);
    const beforeSecond = getDebugNode(beforeDump, secondNodeId);
    const selectionCenter = getCombinedCenter(beforeFirst, beforeSecond);

    const rotatedNodeIds = editor.rotateSelectionBy({ deltaRotation: 30 });

    const afterDump = editor.getDebugDump();
    const afterFirst = getDebugNode(afterDump, firstNodeId);
    const afterSecond = getDebugNode(afterDump, secondNodeId);
    const rotationDelta =
      afterFirst.transform.rotation - beforeFirst.transform.rotation;

    expect(rotatedNodeIds).toEqual([firstNodeId, secondNodeId]);
    expect(afterDump.selection.ids).toEqual([firstNodeId, secondNodeId]);
    expect(rotationDelta).toBeCloseTo(30, 6);
    expect(
      afterSecond.transform.rotation - beforeSecond.transform.rotation
    ).toBeCloseTo(rotationDelta, 6);

    const expectedFirstCenter = rotatePointAround(
      getFrameCenter(beforeFirst),
      selectionCenter,
      rotationDelta
    );
    const expectedSecondCenter = rotatePointAround(
      getFrameCenter(beforeSecond),
      selectionCenter,
      rotationDelta
    );
    const afterFirstCenter = getFrameCenter(afterFirst);
    const afterSecondCenter = getFrameCenter(afterSecond);

    expect(afterFirstCenter.x).toBeCloseTo(expectedFirstCenter.x, 2);
    expect(afterFirstCenter.y).toBeCloseTo(expectedFirstCenter.y, 2);
    expect(afterSecondCenter.x).toBeCloseTo(expectedSecondCenter.x, 2);
    expect(afterSecondCenter.y).toBeCloseTo(expectedSecondCenter.y, 2);
  });

  test("previews selected group rotation and commits descendants once", () => {
    const editor = createEditor();
    const firstNodeId = createTextNode(editor, {
      text: "Rotate first",
      x: 520,
      y: 320,
    });
    const secondNodeId = createTextNode(editor, {
      text: "Rotate second",
      x: 760,
      y: 520,
    });

    editor.setSelectedNodes([firstNodeId, secondNodeId]);
    editor.groupSelected();

    const groupNodeId = editor.selectedNodeId;
    expect(groupNodeId).toBeTruthy();

    const beforeFirst = getDebugNode(editor.getDebugDump(), firstNodeId);
    const session = editor.beginRotateSelection({ nodeId: groupNodeId });

    expect(session).toBeTruthy();

    const previewNodeIds = editor.updateRotateSelection(session, {
      deltaRotation: 24,
    });
    const duringFirst = getDebugNode(editor.getDebugDump(), firstNodeId);

    expect(previewNodeIds).toEqual([groupNodeId]);
    expect(editor.selectionDragPreview?.rotate?.deltaRotation).toBe(24);
    expect(duringFirst.transform.rotation).toBe(beforeFirst.transform.rotation);

    const committedNodeIds = editor.commitRotateSelection(session);
    const afterFirst = getDebugNode(editor.getDebugDump(), firstNodeId);

    expect(committedNodeIds).toEqual([firstNodeId, secondNodeId]);
    expect(editor.selectionDragPreview).toBeNull();
    expect(
      afterFirst.transform.rotation - beforeFirst.transform.rotation
    ).toBeCloseTo(24, 6);
  });

  test("commits nested group rotation in parent-local coordinates", () => {
    const editor = createEditor();
    const rootGroupId = "imported-svg";
    const nestedGroupId = "nested-group";
    const backgroundPathId = "background-path";
    const nestedPathId = "nested-path";

    editor.insertNodes([
      {
        id: rootGroupId,
        name: "Imported SVG",
        parentId: "root",
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        type: "group",
        visible: true,
      },
      {
        id: nestedGroupId,
        name: "Nested group",
        parentId: rootGroupId,
        transform: { rotation: 20, scaleX: 1, scaleY: 1, x: 300, y: 300 },
        type: "group",
        visible: true,
      },
      createPathNode({
        fill: "#3AAAFF",
        id: backgroundPathId,
        parentId: rootGroupId,
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 100, y: 100 },
        bounds: { maxX: 600, maxY: 600, minX: 0, minY: 0 },
      }),
      createPathNode({
        fill: "#F99B28",
        id: nestedPathId,
        parentId: nestedGroupId,
        transform: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        bounds: { maxX: 80, maxY: 40, minX: -80, minY: -40 },
      }),
    ]);
    editor.setSelectedNodes([rootGroupId]);

    const deltaRotation = 30;
    const session = editor.beginRotateSelection({ nodeId: rootGroupId });

    expect(session).toBeTruthy();

    const beforeBackgroundCenter = getComposedNodeFrameCenter(
      editor,
      backgroundPathId
    );
    const beforeNestedCenter = getComposedNodeFrameCenter(editor, nestedPathId);
    const beforeSelectionCenter = session.selectionCenter;
    const expectedBackgroundCenter = rotatePointAround(
      beforeBackgroundCenter,
      beforeSelectionCenter,
      deltaRotation
    );
    const expectedNestedCenter = rotatePointAround(
      beforeNestedCenter,
      beforeSelectionCenter,
      deltaRotation
    );

    editor.updateRotateSelection(session, { deltaRotation });
    editor.commitRotateSelection(session);

    const afterBackgroundCenter = getComposedNodeFrameCenter(
      editor,
      backgroundPathId
    );
    const afterNestedCenter = getComposedNodeFrameCenter(editor, nestedPathId);

    expect(afterBackgroundCenter.x).toBeCloseTo(expectedBackgroundCenter.x, 2);
    expect(afterBackgroundCenter.y).toBeCloseTo(expectedBackgroundCenter.y, 2);
    expect(afterNestedCenter.x).toBeCloseTo(expectedNestedCenter.x, 2);
    expect(afterNestedCenter.y).toBeCloseTo(expectedNestedCenter.y, 2);
  });
});

const createEditor = () => {
  const editor = new Editor();

  editor.applyLocalFontCatalog({
    error: "",
    fonts: [{ ...ARIAL_FONT, id: "arialmt" }],
    state: "ready",
  });

  return editor;
};

const createTextNode = (editor, { text, x, y }) => {
  editor.addTextNode({ x, y });
  editor.setEditingText(text);
  editor.finalizeEditing();

  if (!editor.selectedNodeId) {
    throw new Error("Expected a selected node after creating text");
  }

  return editor.selectedNodeId;
};

const createPathNode = ({ bounds, fill, id, parentId, transform }) => {
  const contour = createRectContour(bounds);

  return {
    closed: true,
    contours: [contour],
    fill,
    fillRule: "nonzero",
    id,
    parentId,
    segments: contour.segments,
    stroke: null,
    strokeLineCap: "butt",
    strokeLineJoin: "miter",
    strokeMiterLimit: 4,
    strokeWidth: 0,
    transform,
    type: "path",
    visible: true,
  };
};

const createRectContour = ({ maxX, maxY, minX, minY }) => {
  const zeroHandle = { x: 0, y: 0 };

  return {
    closed: true,
    segments: [
      {
        handleIn: zeroHandle,
        handleOut: zeroHandle,
        point: { x: minX, y: minY },
        pointType: "corner",
      },
      {
        handleIn: zeroHandle,
        handleOut: zeroHandle,
        point: { x: maxX, y: minY },
        pointType: "corner",
      },
      {
        handleIn: zeroHandle,
        handleOut: zeroHandle,
        point: { x: maxX, y: maxY },
        pointType: "corner",
      },
      {
        handleIn: zeroHandle,
        handleOut: zeroHandle,
        point: { x: minX, y: maxY },
        pointType: "corner",
      },
    ],
  };
};

const getDebugNode = (dump, nodeId) => {
  const node = dump.nodes.find((item) => item.id === nodeId);

  if (!node) {
    throw new Error(`Missing node ${nodeId} in debug dump`);
  }

  if (!node.frame) {
    throw new Error(`Missing frame for node ${nodeId} in debug dump`);
  }

  return node;
};

const getFrameCenter = (node) => {
  return {
    x: (node.frame.bounds.minX + node.frame.bounds.maxX) / 2,
    y: (node.frame.bounds.minY + node.frame.bounds.maxY) / 2,
  };
};

const getComposedNodeFrameCenter = (editor, nodeId) => {
  const node = editor.getNode(nodeId);
  const bounds = getNodeLocalBounds(node);

  if (!(node && bounds)) {
    throw new Error(`Missing composed frame for ${nodeId}`);
  }

  const localCenter = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };

  return getComposedPoint(editor, nodeId, localCenter);
};

const getNodeLocalBounds = (node) => {
  const points = (node?.contours || [])
    .flatMap((contour) => contour.segments || [])
    .map((segment) => segment.point)
    .filter(Boolean);

  if (points.length === 0) {
    return null;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
    minX: Math.min(...xs),
    minY: Math.min(...ys),
  };
};

const getComposedPoint = (editor, nodeId, point) => {
  const chain: Array<{
    parentId?: string | null;
    transform?: { rotation?: number; x?: number; y?: number };
  }> = [];
  let currentNode = editor.getNode(nodeId);

  while (currentNode) {
    chain.push(currentNode);
    currentNode = currentNode.parentId
      ? editor.getNode(currentNode.parentId)
      : null;
  }

  return chain.reverse().reduce((currentPoint, node) => {
    const transform = node.transform || {};
    const bounds =
      getNodeLocalBounds(node) || editor.getNodeTransformBounds(node.id);
    const localCenter = bounds
      ? {
          x: (bounds.minX + bounds.maxX) / 2,
          y: (bounds.minY + bounds.maxY) / 2,
        }
      : { x: 0, y: 0 };
    const scaledOffset = {
      x: (currentPoint.x - localCenter.x) * (transform.scaleX ?? 1),
      y: (currentPoint.y - localCenter.y) * (transform.scaleY ?? 1),
    };
    const rotatedOffset = rotatePointAround(
      scaledOffset,
      { x: 0, y: 0 },
      transform.rotation || 0
    );

    return {
      x: (transform.x || 0) + localCenter.x + rotatedOffset.x,
      y: (transform.y || 0) + localCenter.y + rotatedOffset.y,
    };
  }, point);
};

const getCombinedCenter = (firstNode, secondNode) => {
  return {
    x:
      (Math.min(firstNode.frame.bounds.minX, secondNode.frame.bounds.minX) +
        Math.max(firstNode.frame.bounds.maxX, secondNode.frame.bounds.maxX)) /
      2,
    y:
      (Math.min(firstNode.frame.bounds.minY, secondNode.frame.bounds.minY) +
        Math.max(firstNode.frame.bounds.maxY, secondNode.frame.bounds.maxY)) /
      2,
  };
};

const rotatePointAround = (point, center, rotation) => {
  const angle = (rotation * Math.PI) / 180;
  const offsetX = point.x - center.x;
  const offsetY = point.y - center.y;

  return {
    x: center.x + offsetX * Math.cos(angle) - offsetY * Math.sin(angle),
    y: center.y + offsetX * Math.sin(angle) + offsetY * Math.cos(angle),
  };
};
