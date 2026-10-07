import {
  createDefaultArtboardNode,
  createDefaultNode,
  createDefaultShapeNode,
  type Editor,
} from "@punchpress/engine";
import {
  DEFAULT_LOCAL_FONT,
  saveDesignDocument,
} from "@punchpress/punch-schema";

const APPEARANCE_ARTBOARD_SIZE = { height: 5400, width: 4500 };

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
        fill: "#1f6feb",
        height: size,
        parentId: artboard.id,
        stroke: null,
        strokeWidth: 0,
        transform: { ...node.transform, x, y },
        width: size,
      };
    }

    const node = createDefaultNode(DEFAULT_LOCAL_FONT);

    return {
      ...node,
      fill: "#111111",
      fontSize: size * 0.4,
      parentId: artboard.id,
      stroke: null,
      strokeWidth: 0,
      text: `Tee ${index}`,
      transform: { ...node.transform, x: x + size / 2, y: y + size / 2 },
    };
  });

  return { artboard, children };
};

export const loadAppearanceBenchmarkScene = async (
  editor: Editor,
  nodeCount: number,
  waitForFrame: () => Promise<number>
) => {
  const { artboard, children } = createAppearanceBenchmarkNodes(nodeCount);

  editor.loadDocument(saveDesignDocument([artboard, ...children]).contents);
  editor.cancelPendingViewportFocus();
  await waitForGeometryReady(
    editor,
    children.map((node) => node.id),
    waitForFrame
  );

  return { artboard, children };
};

// Viewport x/y is the world-space top-left, so keeping the artboard center
// fixed while zooming means recomputing the corner for every zoom.
export const getCenteredViewport = (editor: Editor, zoom: number) => {
  const rect = editor.hostRef?.getBoundingClientRect();
  const width = rect?.width ?? 1280;
  const height = rect?.height ?? 800;

  return {
    x: APPEARANCE_ARTBOARD_SIZE.width / 2 - width / zoom / 2,
    y: APPEARANCE_ARTBOARD_SIZE.height / 2 - height / zoom / 2,
    zoom,
  };
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
