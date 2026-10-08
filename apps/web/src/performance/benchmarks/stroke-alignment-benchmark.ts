import type {
  PerformanceBenchmarkContext,
  PerformanceBenchmarkDefinition,
} from "../performance-benchmark-types";
import {
  getCenteredViewport,
  getCenterNodeId,
  loadAppearanceBenchmarkScene,
} from "./appearance-benchmark-scene";
import {
  applyStrokePair,
  getFittedViewport,
  getScrubWidth,
  loadStrokeTextScene,
  type StrokeTextWarp,
} from "./stroke-alignment-benchmark-scene";

const NODE_COUNT = 200;

const DEFAULT_OPTIONS = {
  frames: 180,
  nodeCount: NODE_COUNT,
  stepX: 0,
  stepY: 0,
  warmupFrames: 12,
};

// Stage 5 gates: every aligned scenario has a `-center` twin with the same
// layer count and widths, so aligned cost is read relative to center strokes.
const createSceneScrubBenchmark = (
  scope: "one" | "all",
  aligned: boolean
): PerformanceBenchmarkDefinition => {
  const suffix = aligned ? "" : "-center";
  const strokes = aligned ? "outside + inside" : "two center";
  const target = scope === "one" ? "one selected node" : "all 200 nodes";

  return {
    defaultOptions: DEFAULT_OPTIONS,
    description: `The 200-node appearance scene with ${strokes} strokes on every node; scrubs both stroke widths 1→40→1 on ${target} each frame at 100% zoom.`,
    id: `appearance-stroke-scrub-${scope === "one" ? "one-of-200" : "all-200"}${suffix}`,
    label: `Stroke Width Scrub (${scope === "one" ? "1 of 200" : "all 200"}, ${aligned ? "aligned" : "center"})`,
    setup: async ({ editor, options, waitForFrame, waitForFrames }) => {
      const { children } = await loadAppearanceBenchmarkScene(
        editor,
        options.nodeCount,
        waitForFrame
      );
      const nodeIds = children.map((node) => node.id);

      applyStrokePair(editor, nodeIds, aligned);
      editor.moveViewportTo(getCenteredViewport(editor, 1));
      editor.setSelectedNodes(
        scope === "one" ? [getCenterNodeId(editor, nodeIds)] : nodeIds
      );
      await waitForFrames(4);
    },
    run: (context) => scrubSelectedStrokeWidths(context),
    usesScratchDocument: true,
  };
};

const createTextScrubBenchmark = (
  warp: StrokeTextWarp,
  aligned: boolean
): PerformanceBenchmarkDefinition => {
  return {
    defaultOptions: DEFAULT_OPTIONS,
    description: `One 500-glyph ${warp} text node with a fill and ${aligned ? "outside + inside" : "two center"} strokes; scrubs both stroke widths 1→40→1 each frame.`,
    id: `appearance-stroke-scrub-text-500-${warp}${aligned ? "" : "-center"}`,
    label: `Stroke Width Scrub (500-glyph ${warp} text, ${aligned ? "aligned" : "center"})`,
    setup: (context) => setupStrokeText(context, warp, aligned),
    run: (context) => scrubSelectedStrokeWidths(context),
    usesScratchDocument: true,
  };
};

const createTextTypingBenchmark = (
  aligned: boolean
): PerformanceBenchmarkDefinition => {
  return {
    defaultOptions: DEFAULT_OPTIONS,
    description: `One 500-glyph arch-warped text node with a fill and ${aligned ? "outside + inside" : "two center"} strokes; appends or removes one character each frame.`,
    id: `appearance-stroke-type-text-500-warped${aligned ? "" : "-center"}`,
    label: `Stroke Text Typing (500-glyph warped, ${aligned ? "aligned" : "center"})`,
    setup: (context) => setupStrokeText(context, "warped", aligned),
    run: async ({ editor, options, waitForFrame }) => {
      const nodeId = editor.selectedNodeIds[0];
      const text = editor.getNode(nodeId)?.text ?? "";
      const historyMark = editor.markHistoryStep("type text");

      try {
        for (let index = 0; index < options.frames; index += 1) {
          await waitForFrame();

          // Type 8 characters, delete them, repeat: every frame reshapes.
          const typed = index % 16 < 8 ? (index % 8) + 1 : 8 - (index % 8) - 1;

          editor.updateNode(nodeId, {
            text: text + "Tees!!!!".slice(0, typed),
          });
        }
      } finally {
        editor.commitHistoryStep(historyMark);
      }
    },
    usesScratchDocument: true,
  };
};

// Mirrors the stroke-width ScrubSlider: one history step around the scrub and
// one `updateAppearanceLayer` per scrubbed stroke per frame, on the selection
// unless `nodeIds` names other nodes.
const scrubSelectedStrokeWidths = async (
  { editor, options, waitForFrame }: PerformanceBenchmarkContext,
  strokeIndexes: readonly number[] = [0, 1],
  nodeIds: string[] = editor.selectedNodeIds
) => {
  const historyMark = editor.markHistoryStep("edit stroke width");

  try {
    for (let index = 0; index < options.frames; index += 1) {
      await waitForFrame();

      const width = getScrubWidth(index, options.frames);

      for (const strokeIndex of strokeIndexes) {
        editor.updateAppearanceLayer(
          { index: strokeIndex, list: "strokes" },
          { width },
          nodeIds
        );
      }
    }
  } finally {
    editor.commitHistoryStep(historyMark);
  }
};

// Isolation twin of `appearance-stroke-scrub-one-of-200`: scrubs only the
// first stroke width, so render counts separate the scrubbed field from its
// untouched sibling.
const singleStrokeScrubBenchmark: PerformanceBenchmarkDefinition = {
  ...createSceneScrubBenchmark("one", true),
  description:
    "The 200-node appearance scene with outside + inside strokes on every node; scrubs only the first stroke width 1→40→1 on one selected node each frame at 100% zoom.",
  id: "appearance-stroke-scrub-one-of-200-single",
  label: "Stroke Width Scrub (1 of 200, one stroke)",
  run: (context) => scrubSelectedStrokeWidths(context, [0]),
};

// Broad-invalidation guard: one node stays selected while another node's
// stroke width is scrubbed, so the properties panel has nothing to show.
const unselectedStrokeScrubBenchmark: PerformanceBenchmarkDefinition = {
  ...createSceneScrubBenchmark("one", true),
  description:
    "The 200-node appearance scene with outside + inside strokes on every node; one node stays selected while another node's first stroke width scrubs 1→40→1 each frame at 100% zoom.",
  id: "appearance-stroke-scrub-unselected",
  label: "Stroke Width Scrub (unselected node)",
  run: (context) => {
    const { editor } = context;
    const target = editor.nodes.find((node) => {
      return (
        node.appearance?.strokes?.length === 2 &&
        !editor.selectedNodeIds.includes(node.id)
      );
    });

    if (!target) {
      throw new Error("The stroke scene has no unselected stroked node.");
    }

    return scrubSelectedStrokeWidths(context, [0], [target.id]);
  },
};

const setupStrokeText = async (
  { editor, waitForFrame, waitForFrames }: PerformanceBenchmarkContext,
  warp: StrokeTextWarp,
  aligned: boolean
) => {
  const node = await loadStrokeTextScene(editor, warp, waitForFrame);

  applyStrokePair(editor, [node.id], aligned);
  editor.setSelectedNodes([node.id]);
  editor.moveViewportTo(getFittedViewport(editor, [node.id]));
  await waitForFrames(4);
};

export const strokeAlignmentBenchmarks = [
  ...[true, false].flatMap((aligned) => [
    createSceneScrubBenchmark("one", aligned),
    createSceneScrubBenchmark("all", aligned),
    createTextScrubBenchmark("flat", aligned),
    createTextScrubBenchmark("circle", aligned),
    createTextScrubBenchmark("warped", aligned),
    createTextTypingBenchmark(aligned),
  ]),
  singleStrokeScrubBenchmark,
  unselectedStrokeScrubBenchmark,
];
