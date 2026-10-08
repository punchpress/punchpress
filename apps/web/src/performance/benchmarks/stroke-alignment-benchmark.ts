import type { Editor } from "@punchpress/engine";
import type {
  PerformanceBenchmarkContext,
  PerformanceBenchmarkDefinition,
} from "../performance-benchmark-types";
import {
  getCenteredViewport,
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
      editor.setViewport(getCenteredViewport(editor, 1));
      editor.setSelectedNodes(
        scope === "one" ? [getCenterNodeId(editor, nodeIds)] : nodeIds
      );
      await waitForFrames(4);
    },
    run: scrubSelectedStrokeWidths,
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
    run: scrubSelectedStrokeWidths,
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
// one `updateAppearanceLayer` per stroke per frame on the selection.
const scrubSelectedStrokeWidths = async ({
  editor,
  options,
  waitForFrame,
}: PerformanceBenchmarkContext) => {
  const historyMark = editor.markHistoryStep("edit stroke width");

  try {
    for (let index = 0; index < options.frames; index += 1) {
      await waitForFrame();

      const width = getScrubWidth(index, options.frames);

      editor.updateAppearanceLayer({ index: 0, list: "strokes" }, { width });
      editor.updateAppearanceLayer({ index: 1, list: "strokes" }, { width });
    }
  } finally {
    editor.commitHistoryStep(historyMark);
  }
};

const setupStrokeText = async (
  { editor, waitForFrame, waitForFrames }: PerformanceBenchmarkContext,
  warp: StrokeTextWarp,
  aligned: boolean
) => {
  const node = await loadStrokeTextScene(editor, warp, waitForFrame);

  applyStrokePair(editor, [node.id], aligned);
  editor.setSelectedNodes([node.id]);
  editor.setViewport(getFittedViewport(editor, [node.id]));
  await waitForFrames(4);
};

// The node nearest the artboard center is on screen at 100% zoom.
const getCenterNodeId = (editor: Editor, nodeIds: string[]) => {
  const viewport = getCenteredViewport(editor, 1);
  const rect = editor.hostRef?.getBoundingClientRect();
  const centerX = viewport.x + (rect?.width ?? 1280) / 2;
  const centerY = viewport.y + (rect?.height ?? 800) / 2;
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

export const strokeAlignmentBenchmarks = [true, false].flatMap((aligned) => [
  createSceneScrubBenchmark("one", aligned),
  createSceneScrubBenchmark("all", aligned),
  createTextScrubBenchmark("flat", aligned),
  createTextScrubBenchmark("circle", aligned),
  createTextScrubBenchmark("warped", aligned),
  createTextTypingBenchmark(aligned),
]);
