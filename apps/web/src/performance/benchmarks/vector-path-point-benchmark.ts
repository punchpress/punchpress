import {
  createDefaultPathNode,
  createDefaultVectorContainerNode,
  offsetEditablePathPoints,
} from "@punchpress/engine";
import { saveDesignDocument } from "@punchpress/punch-schema";
import type { PerformanceBenchmarkDefinition } from "../performance-benchmark-types";
import {
  loadLargeSvgDocument,
  recordLargeSvgStats,
} from "./large-svg-benchmark";

type BenchmarkPathNode = ReturnType<typeof createDefaultPathNode>;
type BenchmarkVectorNode = ReturnType<typeof createDefaultVectorContainerNode>;

const createCurveSegments = () => {
  return [
    {
      handleIn: { x: -40, y: 0 },
      handleOut: { x: 60, y: -110 },
      point: { x: -160, y: 40 },
      pointType: "smooth" as const,
    },
    {
      handleIn: { x: -70, y: -90 },
      handleOut: { x: 70, y: 90 },
      point: { x: 0, y: -80 },
      pointType: "smooth" as const,
    },
    {
      handleIn: { x: -60, y: 110 },
      handleOut: { x: 40, y: 0 },
      point: { x: 160, y: 40 },
      pointType: "smooth" as const,
    },
  ];
};

const createSimpleVectorScene = () => {
  const vectorNode = createDefaultVectorContainerNode();
  const pathNode = createDefaultPathNode(vectorNode.id);

  vectorNode.id = "simple-vector";
  vectorNode.name = "Simple Vector";
  vectorNode.parentId = "root";
  vectorNode.transform = {
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    x: 0,
    y: 0,
  };

  pathNode.id = "simple-vector-path";
  pathNode.parentId = vectorNode.id;
  pathNode.fill = "transparent";
  pathNode.segments = createCurveSegments();
  pathNode.stroke = "#101010";
  pathNode.strokeWidth = 8;
  pathNode.transform = {
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    x: 2250,
    y: 2700,
  };

  return {
    nodes: [vectorNode, pathNode] as Array<
      BenchmarkPathNode | BenchmarkVectorNode
    >,
    pathNodeId: pathNode.id,
    vectorNodeId: vectorNode.id,
  };
};

const getPointDragDelta = (
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
    x: Math.cos(phase * 1.1) * stepX + Math.sin(phase * 0.6) * stepX * 0.35,
    y: Math.sin(phase * 0.9) * stepY + Math.cos(phase * 1.3) * stepY * 0.25,
  };
};

const setupPathPointDrag = async ({ editor, nodeId, point, waitForFrames }) => {
  editor.setActiveTool("node");
  editor.setSelectedNodes([nodeId]);

  if (!editor.startPathEditing(nodeId)) {
    throw new Error(`Unable to start path editing for ${nodeId}.`);
  }

  editor.setPathEditingPoint(point);
  await waitForFrames(2);
};

const runPathPointDrag = async ({ editor, options, waitForFrame }) => {
  const nodeId = editor.pathEditingNodeId;

  if (!nodeId) {
    throw new Error("Path point drag benchmark requires path editing.");
  }

  for (let index = 0; index < options.frames; index += 1) {
    await waitForFrame();

    const session = editor.getEditablePathSession(nodeId);
    const nextContours = offsetEditablePathPoints(
      session?.contours,
      editor.pathEditingPoints,
      getPointDragDelta(index, options)
    );

    if (!nextContours) {
      throw new Error("Unable to compute path point drag preview contours.");
    }

    editor.setPathEditingPreview(nodeId, nextContours);
  }

  editor.commitPathEditingPreview(nodeId);
};

const getLargeSvgPathNodeId = (editor) => {
  const pathNodes = editor.nodes.filter((node) => {
    return node.type === "path" && node.visible !== false;
  });

  const pathNode =
    pathNodes.find((node) => (node.segments?.length || 0) >= 3) || pathNodes[0];

  if (!pathNode) {
    throw new Error("Large SVG benchmark did not contain an editable path.");
  }

  return pathNode.id;
};

export const simpleVectorPathPointDragBenchmark: PerformanceBenchmarkDefinition =
  {
    defaultOptions: {
      frames: 120,
      nodeCount: 0,
      stepX: 3,
      stepY: 2,
      warmupFrames: 12,
    },
    description:
      "Builds a simple vector curve and moves one selected anchor in Node-tool path edit mode.",
    id: "simple-vector-path-point-drag",
    label: "Simple Vector Path Point Drag",
    setup: async ({ editor, waitForFrames }) => {
      const scene = createSimpleVectorScene();

      editor.loadDocument(saveDesignDocument(scene.nodes).contents);
      editor.setViewport({ x: 1650, y: 2100, zoom: 1 });
      await setupPathPointDrag({
        editor,
        nodeId: scene.vectorNodeId,
        point: { contourIndex: 0, segmentIndex: 1 },
        waitForFrames,
      });
    },
    run: runPathPointDrag,
    usesScratchDocument: true,
  };

export const largeSvgPathPointDragBenchmark: PerformanceBenchmarkDefinition = {
  defaultOptions: {
    frames: 120,
    nodeCount: 0,
    stepX: 3,
    stepY: 2,
    warmupFrames: 12,
  },
  description:
    "Loads the large SVG fixture and moves one selected editable path anchor in Node-tool path edit mode.",
  id: "large-svg-path-point-drag",
  label: "Large SVG Path Point Drag",
  setup: async ({ editor, waitForFrames }) => {
    await loadLargeSvgDocument(editor);
    recordLargeSvgStats(editor);

    const pathNodeId = getLargeSvgPathNodeId(editor);

    editor.setViewport({ x: 550, y: 1000, zoom: 0.35 });
    await setupPathPointDrag({
      editor,
      nodeId: pathNodeId,
      point: { contourIndex: 0, segmentIndex: 0 },
      waitForFrames,
    });
  },
  run: runPathPointDrag,
  usesScratchDocument: true,
};
