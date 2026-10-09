import type { Editor } from "@punchpress/engine";
import type {
  PerformanceBenchmarkContext,
  PerformanceBenchmarkDefinition,
} from "../performance-benchmark-types";
import { appearanceDraggingPlainBenchmark } from "./appearance-benchmark";
import {
  getCenteredViewport,
  getCenterNodeId,
  loadAppearanceBenchmarkScene,
} from "./appearance-benchmark-scene";
import {
  addScrubStroke,
  applyEffects,
  applyMaxStack,
  blurShadow,
  getMaxStackFocus,
  getMaxStackZoom,
  getShadowScrubPatch,
} from "./drop-shadow-benchmark-scene";
import { openLayerSettings } from "./open-layer-settings";
import {
  captureViewportHost,
  getCameraCenteredOn,
  positionViewport,
  probeViewportTrajectory,
} from "./viewport-motion";

const MAX_STACK_NODE_COUNT = 20;

const appearanceDraggingShadowBenchmark: PerformanceBenchmarkDefinition = {
  ...appearanceDraggingPlainBenchmark,
  description:
    "Drags all 200 nodes of the appearance scene, each with a blur-24 drop shadow, at 21% zoom.",
  id: "appearance-dragging-200-shadow",
  label: "Appearance Dragging (200, shadow blur 24)",
  setup: async ({ editor, options, waitForFrame, waitForFrames }) => {
    const { children } = await loadAppearanceBenchmarkScene(
      editor,
      options.nodeCount,
      waitForFrame
    );
    const nodeIds = children.map((node) => node.id);

    applyEffects(editor, nodeIds, [blurShadow()]);
    positionViewport(editor, getCenteredViewport(editor, 0.21));
    editor.setSelectedNodes(nodeIds);
    await waitForFrames(4);
  },
};

// Every node carries a blur-24 shadow; the selected center node also has a
// center stroke. The scrub edits the shadow; the control edits the stroke.
// Both open the shadow settings popover so the scrubbed offset and blur
// fields are mounted, as they are while a user scrubs them.
const createShadowScrubBenchmark = (
  control: boolean
): PerformanceBenchmarkDefinition => {
  return {
    defaultOptions: {
      frames: 180,
      nodeCount: 200,
      stepX: 0,
      stepY: 0,
      warmupFrames: 12,
    },
    description: control
      ? "Control for appearance-shadow-scrub: same shadowed scene and node, scrubs the stroke width 1→40→1 each frame instead."
      : "The 200-node scene with blur-24 shadows on every node; scrubs the selected center node's shadow blur 0→40→0 and offset each frame at 100% zoom.",
    id: control ? "appearance-shadow-scrub-control" : "appearance-shadow-scrub",
    label: control
      ? "Shadow Scrub Control (stroke width, 1 of 200)"
      : "Shadow Scrub (1 of 200)",
    setup: async ({ editor, options, waitForFrame, waitForFrames }) => {
      const { children } = await loadAppearanceBenchmarkScene(
        editor,
        options.nodeCount,
        waitForFrame
      );
      const nodeIds = children.map((node) => node.id);
      const targetId = getCenterNodeId(editor, nodeIds);

      applyEffects(editor, nodeIds, [blurShadow()]);
      addScrubStroke(editor, targetId);
      positionViewport(editor, getCenteredViewport(editor, 1));
      editor.setSelectedNodes([targetId]);
      await waitForFrames(4);
      await openLayerSettings("Shadow", waitForFrames);
    },
    run: (context) => scrubSelected(context, control),
    usesScratchDocument: true,
  };
};

// Isolation twin of `appearance-shadow-scrub`: scrubs only the blur, so render
// counts separate the scrubbed field from the untouched offset fields.
const shadowBlurScrubBenchmark: PerformanceBenchmarkDefinition = {
  ...createShadowScrubBenchmark(false),
  description:
    "The 200-node scene with blur-24 shadows on every node; scrubs only the selected center node's shadow blur 0→40→0 each frame at 100% zoom.",
  id: "appearance-shadow-scrub-blur",
  label: "Shadow Blur Scrub (1 of 200)",
  run: async ({ editor, options, waitForFrame }) => {
    const historyMark = editor.markHistoryStep("edit shadow blur");

    try {
      for (let index = 0; index < options.frames; index += 1) {
        await waitForFrame();
        editor.updateEffect(0, {
          blur: getShadowScrubPatch(index, options.frames).blur,
        });
      }
    } finally {
      editor.commitHistoryStep(historyMark);
    }
  },
};

// Mirrors the panel ScrubSlider: one history step around the whole scrub.
const scrubSelected = async (
  { editor, options, waitForFrame }: PerformanceBenchmarkContext,
  control: boolean
) => {
  const historyMark = editor.markHistoryStep(
    control ? "edit stroke width" : "edit shadow"
  );

  try {
    for (let index = 0; index < options.frames; index += 1) {
      await waitForFrame();

      const patch = getShadowScrubPatch(index, options.frames);

      if (control) {
        editor.updateAppearanceLayer(
          { index: 0, list: "strokes" },
          { width: 1 + patch.blur }
        );
      } else {
        editor.updateEffect(0, patch);
      }
    }
  } finally {
    editor.commitHistoryStep(historyMark);
  }
};

// 20 single-level groups of 10 nodes; shadowed variants put one blur-24 shadow
// on each group (rendered as a CSS filter on the group's render layer).
const createShadowedGroupsDragBenchmark = (
  target: "whole" | "child",
  shadowed: boolean
): PerformanceBenchmarkDefinition => {
  const suffix = shadowed ? "" : "-plain";

  return {
    ...appearanceDraggingPlainBenchmark,
    description: `${target === "whole" ? "Drags all 20" : "Drags one child inside one of 20"} ${shadowed ? "blur-24-shadowed" : "unshadowed"} groups of 10 nodes at 21% zoom.`,
    id: `appearance-shadowed-groups-drag-${target}${suffix}`,
    label: `Shadowed Groups Drag (${target}${shadowed ? "" : ", plain"})`,
    setup: async ({ editor, options, waitForFrame, waitForFrames }) => {
      const { children, rootGroupIds } = await loadAppearanceBenchmarkScene(
        editor,
        options.nodeCount,
        waitForFrame,
        { flatGroups: true }
      );

      if (shadowed) {
        applyEffects(editor, rootGroupIds, [blurShadow()]);
      }

      positionViewport(editor, getCenteredViewport(editor, 0.21));
      editor.setSelectedNodes(
        target === "whole" ? rootGroupIds : [children[0].id]
      );
      await waitForFrames(4);
    },
  };
};

const appearanceMaxStackBenchmark: PerformanceBenchmarkDefinition = {
  defaultOptions: {
    frames: 240,
    nodeCount: MAX_STACK_NODE_COUNT,
    stepX: 0,
    stepY: 0,
    warmupFrames: 12,
  },
  description:
    "20 nodes with 8 fills, 8 strokes (center/inside/outside), and 4 shadows up to blur 500, zoomed 1% → 6400% → 1% on one node's edge.",
  id: "appearance-max-stack",
  label: "Appearance Max Stack (20, zoom 1–6400%)",
  setup: async ({ editor, options, waitForFrame, waitForFrames }) => {
    await loadMaxStackScene({ editor, options, waitForFrame, waitForFrames });
    editor.clearSelection();

    const host = captureViewportHost(editor);
    const focus = getMaxStackFocus(editor, getMaxStackFocusId(editor));
    const middle = Math.floor((options.frames - 1) / 2);

    probeViewportTrajectory(
      editor,
      (index) =>
        getCameraCenteredOn(
          host,
          focus,
          getMaxStackZoom(index, options.frames)
        ),
      [0, middle, options.frames - 1]
    );
    await waitForFrames(4);
  },
  run: async ({ editor, options, waitForFrame }) => {
    const host = captureViewportHost(editor);
    const focus = getMaxStackFocus(editor, getMaxStackFocusId(editor));

    editor.setViewportInteracting(true);

    try {
      for (let index = 0; index < options.frames; index += 1) {
        await waitForFrame();
        editor.moveViewportTo(
          getCameraCenteredOn(
            host,
            focus,
            getMaxStackZoom(index, options.frames)
          )
        );
      }
    } finally {
      editor.setViewportInteracting(false);
    }
  },
  usesScratchDocument: true,
};

// Export latency for the max-stack document: the run is one awaited export,
// so the collected frame durations sum to its wall time.
const appearanceMaxStackExportBenchmark: PerformanceBenchmarkDefinition = {
  ...appearanceMaxStackBenchmark,
  defaultOptions: { ...appearanceMaxStackBenchmark.defaultOptions, frames: 1 },
  description:
    "Exports the appearance-max-stack document once (`editor.exportDocument()`); read total frame time as export latency.",
  id: "appearance-max-stack-export",
  label: "Appearance Max Stack Export",
  setup: async (context) => {
    await loadMaxStackScene(context);
    context.editor.clearSelection();
    await context.waitForFrames(4);
  },
  run: async ({ editor }) => {
    await editor.exportDocument();
  },
};

const getMaxStackFocusId = (editor: Editor) => {
  const focusId = editor.nodes.find((node) => node.type === "shape")?.id;

  if (!focusId) {
    throw new Error("Max-stack scene has no shape to focus.");
  }

  return focusId;
};

const loadMaxStackScene = async ({
  editor,
  options,
  waitForFrame,
}: Omit<PerformanceBenchmarkContext, "recordMetric">) => {
  const { children } = await loadAppearanceBenchmarkScene(
    editor,
    options.nodeCount,
    waitForFrame
  );
  const nodeIds = children.map((node) => node.id);

  applyMaxStack(editor, nodeIds);
  editor.setSelectedNodes(
    nodeIds.filter((nodeId) => editor.getNode(nodeId)?.type === "shape")
  );
};

export const dropShadowBenchmarks = [
  appearanceDraggingShadowBenchmark,
  createShadowScrubBenchmark(false),
  createShadowScrubBenchmark(true),
  shadowBlurScrubBenchmark,
  createShadowedGroupsDragBenchmark("whole", true),
  createShadowedGroupsDragBenchmark("whole", false),
  createShadowedGroupsDragBenchmark("child", true),
  createShadowedGroupsDragBenchmark("child", false),
  appearanceMaxStackBenchmark,
  appearanceMaxStackExportBenchmark,
];
