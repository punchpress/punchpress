import {
  createDefaultArtboardNode,
  createDefaultGroupNode,
  createDefaultNode,
  createDefaultShapeNode,
  createSolidAppearance,
  type Editor,
} from "@punchpress/engine";
import {
  DEFAULT_LOCAL_FONT,
  saveDesignDocument,
} from "@punchpress/punch-schema";
import { captureViewportHost, getCameraCenteredOn } from "./viewport-motion";

const APPEARANCE_ARTBOARD_SIZE = { height: 5400, width: 4500 };

export const APPEARANCE_ARTBOARD_CENTER = {
  x: APPEARANCE_ARTBOARD_SIZE.width / 2,
  y: APPEARANCE_ARTBOARD_SIZE.height / 2,
};

const SHAPE_KINDS = ["polygon", "ellipse", "star"] as const;

// Shared scene for every `appearance-*` benchmark: shapes and text alternate
// in a grid that fills one 4500 × 5400 print artboard. The plain variant is the
// control; styled variants layer appearance stacks onto the same geometry.
const createAppearanceBenchmarkNodes = (nodeCount: number) => {
  const artboard = {
    ...createDefaultArtboardNode("Print"),
    ...APPEARANCE_ARTBOARD_SIZE,
  };
  const columnCount = Math.max(1, Math.ceil(Math.sqrt(nodeCount * 0.83)));
  const rowCount = Math.max(1, Math.ceil(nodeCount / columnCount));
  const cellWidth = APPEARANCE_ARTBOARD_SIZE.width / columnCount;
  const cellHeight = APPEARANCE_ARTBOARD_SIZE.height / rowCount;
  // Padding scales with the cell so --node-count overrides never produce
  // negative sizes; the drag benchmark's excursion stays inside this margin.
  const cell = Math.min(cellWidth, cellHeight);
  const padding = cell * 0.2;
  const size = cell - padding * 2;

  const children = Array.from({ length: nodeCount }, (_, index) => {
    const column = index % columnCount;
    const row = Math.floor(index / columnCount);
    const x = column * cellWidth + padding;
    const y = row * cellHeight + padding;

    if (index % 2 === 0) {
      const shape = SHAPE_KINDS[(index / 2) % SHAPE_KINDS.length];
      const node = createDefaultShapeNode(shape);

      return {
        ...node,
        appearance: createSolidAppearance({ fill: "#1f6feb" }),
        height: size,
        parentId: artboard.id,
        transform: { ...node.transform, x, y },
        width: size,
      };
    }

    const node = createDefaultNode(DEFAULT_LOCAL_FONT);

    return {
      ...node,
      appearance: createSolidAppearance({ fill: "#111111" }),
      fontSize: size * 0.4,
      parentId: artboard.id,
      text: `Tee ${index}`,
      transform: { ...node.transform, x: x + size / 2, y: y + size / 2 },
    };
  });

  return { artboard, children };
};

export const loadAppearanceBenchmarkScene = async (
  editor: Editor,
  nodeCount: number,
  waitForFrame: () => Promise<number>,
  {
    flatGroups = false,
    nestedGroupOpacity = GROUP_OPACITY,
    nestedGroups = false,
  } = {}
) => {
  const { artboard, children } = createAppearanceBenchmarkNodes(nodeCount);
  let groups: ReturnType<typeof createDefaultGroupNode>[] = [];

  if (nestedGroups) {
    groups = nestInGroups(
      artboard.id,
      children,
      GROUP_DEPTH,
      nestedGroupOpacity
    );
  } else if (flatGroups) {
    groups = nestInGroups(artboard.id, children, 1, 1);
  }

  editor.loadDocument(
    saveDesignDocument([artboard, ...groups, ...children]).contents
  );
  editor.cancelPendingViewportFocus();
  await waitForGeometryReady(
    editor,
    children.map((node) => node.id),
    waitForFrame
  );

  return {
    artboard,
    children,
    rootGroupIds: groups
      .filter((group) => group.parentId === artboard.id)
      .map((group) => group.id),
  };
};

const GROUP_COUNT = 20;
const GROUP_DEPTH = 3;
const GROUP_OPACITY = 0.6;

// Splits the children into GROUP_COUNT stacks of `depth` nested groups, every
// level at `opacity` (nested scenes: three isolated 60% layers deep).
// Reparents the children in place; the store canonicalizes paint order.
const nestInGroups = (
  artboardId: string,
  children,
  depth: number,
  opacity: number
) => {
  const groups: ReturnType<typeof createDefaultGroupNode>[] = [];
  const perGroup = Math.ceil(children.length / GROUP_COUNT);

  for (let stack = 0; stack < GROUP_COUNT; stack += 1) {
    let parentId = artboardId;

    for (let level = 0; level < depth; level += 1) {
      const group = {
        ...createDefaultGroupNode(),
        name: `Stack ${stack} level ${level}`,
        opacity,
        parentId,
      };

      groups.push(group);
      parentId = group.id;
    }

    for (const child of children.slice(
      stack * perGroup,
      (stack + 1) * perGroup
    )) {
      child.parentId = parentId;
    }
  }

  return groups;
};

export const getCenteredViewport = (editor: Editor, zoom: number) => {
  return getCameraCenteredOn(
    captureViewportHost(editor),
    APPEARANCE_ARTBOARD_CENTER,
    zoom
  );
};

// The node nearest the artboard center is on screen at 100% zoom.
export const getCenterNodeId = (editor: Editor, nodeIds: string[]) => {
  const { x: centerX, y: centerY } = APPEARANCE_ARTBOARD_CENTER;
  let best = nodeIds[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const nodeId of nodeIds) {
    const bounds = editor.getSelectionBounds([nodeId]);

    if (!bounds) {
      continue;
    }

    const distance = Math.hypot(
      (bounds.minX + bounds.maxX) / 2 - centerX,
      (bounds.minY + bounds.maxY) / 2 - centerY
    );

    if (distance < bestDistance) {
      best = nodeId;
      bestDistance = distance;
    }
  }

  return best;
};

const waitForGeometryReady = async (
  editor: Editor,
  nodeIds: string[],
  waitForFrame: () => Promise<number>
) => {
  const timeoutAt = performance.now() + 8000;
  const getPendingIds = () =>
    nodeIds.filter((nodeId) => editor.getNodeGeometry(nodeId)?.ready !== true);

  while (getPendingIds().length > 0) {
    const now = await waitForFrame();

    if (now >= timeoutAt) {
      const pendingIds = getPendingIds();

      throw new Error(
        `Appearance scene geometry not ready for ${pendingIds.length} nodes: ${pendingIds.slice(0, 5).join(", ")}`
      );
    }
  }
};
