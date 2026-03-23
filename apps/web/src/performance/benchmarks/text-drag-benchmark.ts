import { createDefaultNode } from "@punchpress/engine";
import { saveDesignDocument } from "@punchpress/punch-schema";
import type { PerformanceBenchmarkDefinition } from "../performance-benchmark-types";

const createBenchmarkNodes = (nodeCount: number) => {
  const columnCount = Math.max(1, Math.ceil(Math.sqrt(nodeCount)));

  return Array.from({ length: nodeCount }, (_, index) => {
    const node = createDefaultNode();
    const column = index % columnCount;
    const row = Math.floor(index / columnCount);

    return {
      ...node,
      fontSize: 220,
      strokeWidth: 8,
      text: `Node ${index + 1}`,
      warp: { kind: "arch", bend: 0.28 },
      transform: {
        ...node.transform,
        x: 1150 + column * 540,
        y: 1400 + row * 420,
      },
    };
  });
};

const waitForGeometryReady = async (
  editor,
  nodeIds: string[],
  waitForFrame: () => Promise<number>
) => {
  const timeoutAt =
    (typeof performance !== "undefined" ? performance.now() : Date.now()) +
    4000;

  while (true) {
    const allReady = nodeIds.every((nodeId) => {
      return Boolean(editor.getNodeGeometry(nodeId)?.ready);
    });

    if (allReady) {
      return;
    }

    const now = await waitForFrame();

    if (now >= timeoutAt) {
      return;
    }
  }
};

export const textDragBenchmark: PerformanceBenchmarkDefinition = {
  defaultOptions: {
    frames: 180,
    nodeCount: 50,
    stepX: 11,
    stepY: 3,
    warmupFrames: 18,
  },
  description:
    "Builds a scratch text scene and drags the selection for a fixed 180-frame pass.",
  id: "text-drag-grid",
  label: "Drag Text Grid",
  setup: async ({ editor, options, waitForFrame, waitForFrames }) => {
    const nodes = createBenchmarkNodes(options.nodeCount);

    editor.loadDocument(saveDesignDocument(nodes).contents);
    editor.setSelectedNodes(nodes.map((node) => node.id));
    await waitForFrame();
    await waitForGeometryReady(
      editor,
      nodes.map((node) => node.id),
      waitForFrame
    );
    await waitForFrames(2);
  },
  run: async ({ editor, options, waitForFrame }) => {
    const dragSession = editor.beginSelectionDrag({
      nodeIds: editor.selectedNodeIds,
    });

    if (!dragSession) {
      throw new Error("Unable to start the drag benchmark session.");
    }

    try {
      for (let index = 0; index < options.frames; index += 1) {
        await waitForFrame();

        editor.updateSelectionDrag(dragSession, {
          delta: {
            x: index % 2 === 0 ? options.stepX : -options.stepX * 0.82,
            y: index % 3 === 0 ? options.stepY : -options.stepY * 0.35,
          },
          queueRefresh: true,
        });
      }
    } finally {
      editor.endSelectionDrag(dragSession);
    }
  },
};
