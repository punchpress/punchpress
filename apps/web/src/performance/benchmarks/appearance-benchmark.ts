import type { PerformanceBenchmarkDefinition } from "../performance-benchmark-types";
import {
  getCenteredViewport,
  loadAppearanceBenchmarkScene,
} from "./appearance-benchmark-scene";
import { positionViewport } from "./viewport-motion";

const NODE_COUNT = 200;

export const appearanceDraggingPlainBenchmark: PerformanceBenchmarkDefinition =
  {
    defaultOptions: {
      frames: 180,
      nodeCount: NODE_COUNT,
      stepX: 11,
      stepY: 3,
      warmupFrames: 18,
    },
    description:
      "Control scene for appearance work: drags all 200 solid-fill nodes inside the 4500 × 5400 artboard at 21% zoom.",
    id: "appearance-dragging-200-plain",
    label: "Appearance Dragging (200, plain)",
    setup: async ({ editor, options, waitForFrame, waitForFrames }) => {
      const { children } = await loadAppearanceBenchmarkScene(
        editor,
        options.nodeCount,
        waitForFrame
      );

      positionViewport(editor, getCenteredViewport(editor, 0.21));
      editor.setSelectedNodes(children.map((node) => node.id));
      await waitForFrames(4);
    },
    run: async ({ editor, options, waitForFrame }) => {
      const dragSession = editor.beginSelectionDrag({
        nodeIds: editor.selectedNodeIds,
      });

      if (!dragSession) {
        throw new Error("Unable to start the appearance drag session.");
      }

      try {
        for (let index = 0; index < options.frames; index += 1) {
          await waitForFrame();

          const from = getDragPathPoint(index, options);
          const to = getDragPathPoint(index + 1, options);

          editor.updateSelectionDrag(dragSession, {
            delta: { x: to.x - from.x, y: to.y - from.y },
            queueRefresh: true,
          });
        }
      } finally {
        editor.endSelectionDrag(dragSession);
      }
    },
    usesScratchDocument: true,
  };

// One closed ellipse per run. Deltas are differences between successive path
// points, so the excursion stays bounded (stepX * 16 by stepY * 16) whatever
// the frame count.
const getDragPathPoint = (
  index: number,
  { frames, stepX, stepY }: { frames: number; stepX: number; stepY: number }
) => {
  const angle = (index / Math.max(1, frames)) * Math.PI * 2;

  return {
    x: (Math.cos(angle) - 1) * stepX * 16,
    y: Math.sin(angle) * stepY * 16,
  };
};

export const appearanceNestedGroupsDraggingBenchmark: PerformanceBenchmarkDefinition =
  {
    ...appearanceDraggingPlainBenchmark,
    description:
      "Drags all 20 nested translucent group stacks (200 nodes) inside the 4500 × 5400 artboard at 21% zoom.",
    id: "appearance-nested-groups-dragging-200",
    label: "Appearance Nested Groups Dragging (200)",
    setup: async ({ editor, options, waitForFrame, waitForFrames }) => {
      const { rootGroupIds } = await loadAppearanceBenchmarkScene(
        editor,
        options.nodeCount,
        waitForFrame,
        { nestedGroups: true }
      );

      positionViewport(editor, getCenteredViewport(editor, 0.21));
      editor.setSelectedNodes(rootGroupIds);
      await waitForFrames(4);
    },
  };
