import {
  createDefaultPathNode,
  createDefaultVectorNode,
} from "@punchpress/engine";
import { saveDesignDocument } from "@punchpress/punch-schema";
import type { PerformanceBenchmarkDefinition } from "../performance-benchmark-types";

type BenchmarkVectorNode = ReturnType<typeof createDefaultVectorNode>;
type BenchmarkPathNode = ReturnType<typeof createDefaultPathNode>;

const createRectangleSegments = (width: number, height: number) => {
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  return [
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: -halfWidth, y: -halfHeight },
      pointType: "corner" as const,
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: halfWidth, y: -halfHeight },
      pointType: "corner" as const,
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: halfWidth, y: halfHeight },
      pointType: "corner" as const,
    },
    {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: { x: -halfWidth, y: halfHeight },
      pointType: "corner" as const,
    },
  ];
};

const createCompoundVectorScene = (nodeCount: number) => {
  const columnCount = Math.max(1, Math.ceil(Math.sqrt(nodeCount)));
  const nodes: Array<BenchmarkPathNode | BenchmarkVectorNode> = [];
  const vectorIds: string[] = [];

  for (let index = 0; index < nodeCount; index += 1) {
    const vectorNode = createDefaultVectorNode();
    const outerPath = createDefaultPathNode(vectorNode.id);
    const innerPath = createDefaultPathNode(vectorNode.id);
    const column = index % columnCount;
    const row = Math.floor(index / columnCount);
    const x = 1100 + column * 360;
    const y = 1300 + row * 300;

    vectorNode.contours = [];
    vectorNode.parentId = "root";
    vectorNode.pathComposition = "compound-fill";
    vectorNode.transform = {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 0,
      y: 0,
    };

    outerPath.fill = "#101010";
    outerPath.fillRule = "evenodd";
    outerPath.segments = createRectangleSegments(220, 160);
    outerPath.stroke = "#202020";
    outerPath.strokeWidth = 6;
    outerPath.transform = {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x,
      y,
    };

    innerPath.fill = "#101010";
    innerPath.fillRule = "evenodd";
    innerPath.segments = createRectangleSegments(92, 68);
    innerPath.stroke = "#202020";
    innerPath.strokeWidth = 6;
    innerPath.transform = {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: x + 8,
      y: y + 6,
    };

    vectorIds.push(vectorNode.id);
    nodes.push(vectorNode, outerPath, innerPath);
  }

  return { nodes, vectorIds };
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
  const phase = progress * Math.PI * 2;

  return {
    x: Math.cos(phase * 1.14) * stepX * 18 + Math.sin(phase * 0.7) * stepX * 4,
    y: Math.sin(phase * 0.92) * stepY * 28 + Math.cos(phase * 1.3) * stepY * 5,
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

export const compoundVectorDragBenchmark: PerformanceBenchmarkDefinition = {
  defaultOptions: {
    frames: 120,
    nodeCount: 60,
    stepX: 10,
    stepY: 4,
    warmupFrames: 12,
  },
  description:
    "Builds a scratch 60-compound-vector scene and drags the selection for a fixed 120-frame pass.",
  id: "compound-vectors-dragging-60",
  label: "Compound Vectors Dragging (60)",
  setup: async ({ editor, options, waitForFrame, waitForFrames }) => {
    const scene = createCompoundVectorScene(options.nodeCount);

    editor.loadDocument(saveDesignDocument(scene.nodes).contents);
    editor.setSelectedNodes(scene.vectorIds);
    await waitForFrame();
    await waitForFrames(2);
  },
  run: async ({ editor, options, waitForFrame }) => {
    const dragSession = editor.beginSelectionDrag({
      nodeIds: editor.selectedNodeIds,
    });

    if (!dragSession) {
      throw new Error("Unable to start the compound vector drag benchmark.");
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
