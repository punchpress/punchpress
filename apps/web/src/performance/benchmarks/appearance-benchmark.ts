import type { PerformanceBenchmarkDefinition } from "../performance-benchmark-types";
import {
  getCenteredViewport,
  loadAppearanceBenchmarkScene,
} from "./appearance-benchmark-scene";

// Matches the DPR visual sweep ladder so perf and pixel gates cover the same zooms.
const APPEARANCE_ZOOM_LADDER = [1, 0.5, 0.35, 0.21, 0.1, 0.05, 0.01];

const NODE_COUNT = 200;

export const appearanceViewportPlainBenchmark: PerformanceBenchmarkDefinition =
  {
    defaultOptions: {
      frames: 280,
      nodeCount: NODE_COUNT,
      stepX: 6,
      stepY: 4,
      warmupFrames: 12,
    },
    description:
      "Control scene for appearance work: 200 solid-fill shapes and text in one 4500 × 5400 artboard, zoomed down the 100→1% ladder and back up while panning.",
    id: "appearance-viewport-200-plain",
    label: "Appearance Viewport (200, plain)",
    setup: async ({ editor, options, waitForFrame, waitForFrames }) => {
      await loadAppearanceBenchmarkScene(
        editor,
        options.nodeCount,
        waitForFrame
      );
      editor.clearSelection();
      editor.moveViewportTo(
        getCenteredViewport(editor, APPEARANCE_ZOOM_LADDER[0])
      );
      await waitForFrames(4);
    },
    run: async ({ editor, options, waitForFrame }) => {
      editor.setViewportInteracting(true);

      try {
        for (let index = 0; index < options.frames; index += 1) {
          await waitForFrame();

          const viewport = getCenteredViewport(
            editor,
            getLadderZoom(getPingPongProgress(index, options.frames))
          );
          const phase = (index / options.frames) * Math.PI * 4;

          editor.setViewport({
            x:
              viewport.x +
              (Math.sin(phase) * options.stepX * 10) / viewport.zoom,
            y:
              viewport.y +
              (Math.cos(phase) * options.stepY * 10) / viewport.zoom,
            zoom: viewport.zoom,
          });
          editor.onViewportChange?.();
        }
      } finally {
        editor.setViewportInteracting(false);
      }
    },
    usesScratchDocument: true,
  };

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

      editor.moveViewportTo(getCenteredViewport(editor, 0.21));
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

// Zoom out over the first half and back in over the second, because Chromium
// raster-scale reuse differs by zoom direction.
const getPingPongProgress = (index: number, frames: number) => {
  const progress = index / Math.max(1, frames - 1);

  return progress <= 0.5 ? progress * 2 : (1 - progress) * 2;
};

// Geometric interpolation between ladder stops so every stop gets equal time.
const getLadderZoom = (progress: number) => {
  const segments = APPEARANCE_ZOOM_LADDER.length - 1;
  const position = Math.min(segments, Math.max(0, progress * segments));
  const index = Math.min(segments - 1, Math.floor(position));
  const local = position - index;
  const from = APPEARANCE_ZOOM_LADDER[index];
  const to = APPEARANCE_ZOOM_LADDER[index + 1];

  return from * (to / from) ** local;
};

export const appearanceNestedGroupsViewportBenchmark: PerformanceBenchmarkDefinition =
  {
    ...appearanceViewportPlainBenchmark,
    description:
      "The appearance scene with its 200 nodes in 20 stacks of three nested 60%-opacity groups, zoomed down the 100→1% ladder and back while panning.",
    id: "appearance-nested-groups-viewport-200",
    label: "Appearance Nested Groups Viewport (200)",
    setup: async ({ editor, options, waitForFrame, waitForFrames }) => {
      await loadAppearanceBenchmarkScene(
        editor,
        options.nodeCount,
        waitForFrame,
        {
          nestedGroups: true,
        }
      );
      editor.clearSelection();
      editor.moveViewportTo(
        getCenteredViewport(editor, APPEARANCE_ZOOM_LADDER[0])
      );
      await waitForFrames(4);
    },
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

      editor.moveViewportTo(getCenteredViewport(editor, 0.21));
      editor.setSelectedNodes(rootGroupIds);
      await waitForFrames(4);
    },
  };
