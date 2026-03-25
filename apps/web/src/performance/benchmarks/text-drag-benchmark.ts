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

const getDragPathPoint = (
  index: number,
  {
    frames,
    stepX,
    stepY,
  }: {
    frames: number;
    stepX: number;
    stepY: number;
  }
) => {
  const progress = Math.min(1, Math.max(0, index / Math.max(1, frames)));
  const loopCount = 1.15;
  const phase = progress * Math.PI * 2;
  const angle =
    progress * Math.PI * 2 * loopCount + Math.sin(phase * 1.3) * 0.18;
  const radiusScale = 1 + Math.sin(phase * 1.1 - Math.PI / 6) * 0.14;
  const radiusX = stepX * 16 * radiusScale;
  const radiusY = stepY * 26 * (0.92 + Math.cos(phase * 0.8) * 0.08);
  const driftX = Math.sin(phase * 0.7 + 0.3) * stepX * 3.4;
  const driftY = Math.sin(phase * 1.4 - 0.5) * stepY * 4.8;

  return {
    x: Math.cos(angle) * radiusX + driftX,
    y: Math.sin(angle) * radiusY + driftY,
  };
};

const getDragDelta = (
  index: number,
  options: {
    frames: number;
    stepX: number;
    stepY: number;
  }
) => {
  const previousPoint = getDragPathPoint(index, options);
  const nextPoint = getDragPathPoint(index + 1, options);

  return {
    x: nextPoint.x - previousPoint.x,
    y: nextPoint.y - previousPoint.y,
  };
};

export const textDragBenchmark: PerformanceBenchmarkDefinition = {
  ...createTextDragBenchmark({
    id: "text-nodes-dragging-50",
    label: "Text Nodes Dragging (50)",
    nodeCount: 50,
  }),
};

export const textDragBenchmarkLarge: PerformanceBenchmarkDefinition =
  createTextDragBenchmark({
    id: "text-nodes-dragging-500",
    label: "Text Nodes Dragging (500)",
    nodeCount: 500,
  });

function createTextDragBenchmark({
  id,
  label,
  nodeCount,
}: {
  id: string;
  label: string;
  nodeCount: number;
}): PerformanceBenchmarkDefinition {
  return {
    defaultOptions: {
      frames: 180,
      nodeCount,
      stepX: 11,
      stepY: 3,
      warmupFrames: 18,
    },
    description: `Builds a scratch ${nodeCount}-node text scene and drags the selection for a fixed 180-frame pass.`,
    id,
    label,
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
            delta: getDragDelta(index, options),
            queueRefresh: true,
          });
        }
      } finally {
        editor.endSelectionDrag(dragSession);
      }
    },
    usesScratchDocument: true,
  };
}
