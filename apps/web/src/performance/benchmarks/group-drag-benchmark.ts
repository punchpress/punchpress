import type { Editor } from "@punchpress/engine";
import type {
  PerformanceBenchmarkContext,
  PerformanceBenchmarkDefinition,
} from "../performance-benchmark-types";
import {
  type GroupActionFixture,
  type GroupActionScene,
  recordGroupActionStats,
} from "./group-action-benchmark-scene";
import {
  GROUP_ACTION_NODE_COUNT,
  getGroupActionScene,
  getTargetSectionIndex,
  runSettled,
  selectWithin,
  setupGroupActionScene,
} from "./group-action-sampling";

const DRAG_COUNT = 4;

const getDragTargetIds = (scene: GroupActionScene, target: DragTarget) => {
  if (target === "root") {
    if (!scene.wrapperId) {
      throw new Error("Root drags need the import wrapper group.");
    }

    return [scene.wrapperId];
  }

  return [scene.sectionIds[getTargetSectionIndex(scene)]];
};

type DragTarget = "root" | "section";

// Several drags per run so begin and release get more than one sample. Each
// drag ends displaced along x (alternating direction), because a drag that
// returns to its origin commits nothing.
const runDrags = async (
  context: PerformanceBenchmarkContext,
  targetIds: string[]
) => {
  const { editor, options, recordMetric, waitForFrame } = context;
  const heldFrames = Math.max(2, Math.floor(options.frames / DRAG_COUNT));
  const probeLeafId = editor.getDescendantLeafNodeIds(targetIds[0])[0];
  const getProbeX = () => editor.getNode(probeLeafId)?.transform.x ?? 0;

  recordGroupActionStats(editor, targetIds);

  for (let drag = 0; drag < DRAG_COUNT; drag += 1) {
    const direction = drag % 2 === 0 ? 1 : -1;
    const startX = getProbeX();
    let session: ReturnType<Editor["beginSelectionDrag"]> = null;

    await runSettled(context, "drag.begin", () => {
      session = editor.beginSelectionDrag({ nodeIds: targetIds });
    });

    if (!session) {
      throw new Error("Unable to start the group drag session.");
    }

    let previousFrameAt = await waitForFrame();

    for (let index = 0; index < heldFrames; index += 1) {
      const angle = (index / heldFrames) * Math.PI * 2;
      const nextAngle = ((index + 1) / heldFrames) * Math.PI * 2;

      editor.updateSelectionDrag(session, {
        delta: {
          x: direction * options.stepX,
          y: (Math.sin(nextAngle) - Math.sin(angle)) * options.stepY,
        },
        queueRefresh: true,
      });

      const frameAt = await waitForFrame();

      recordMetric("drag.heldFrameMs", frameAt - previousFrameAt);
      previousFrameAt = frameAt;
    }

    await runSettled(context, "drag.release", () => {
      editor.endSelectionDrag(session, {});
    });

    const movedBy = getProbeX() - startX;

    if (Math.abs(movedBy - direction * options.stepX * heldFrames) > 1) {
      throw new Error(`Group drag committed ${movedBy}, not the drag delta.`);
    }
  }
};

const createDragBenchmark = (
  target: DragTarget,
  fixture: GroupActionFixture
): PerformanceBenchmarkDefinition => {
  return {
    defaultOptions: {
      frames: 160,
      nodeCount: GROUP_ACTION_NODE_COUNT,
      stepX: 24,
      stepY: 120,
      warmupFrames: 12,
    },
    description: `Drags the ${target === "root" ? "import wrapper group" : "middle section group"} of the ${fixture} ~4k-node imported-SVG tree ${DRAG_COUNT} times, each ending displaced; reports begin, held-frame, and release latency.`,
    id: `group-actions-drag-${target}-${fixture}`,
    label: `Group Actions: drag ${target} (${fixture})`,
    setup: async (context) => {
      const scene = await setupGroupActionScene(context, fixture);

      selectWithin(context.editor, getDragTargetIds(scene, target));
      await context.waitForFrames(4);
    },
    run: async (context) => {
      await runDrags(
        context,
        getDragTargetIds(getGroupActionScene(context), target)
      );
    },
    usesScratchDocument: true,
  };
};

export const groupDragBenchmarks = [
  createDragBenchmark("root", "dense"),
  createDragBenchmark("section", "dense"),
  createDragBenchmark("section", "expanded"),
  createDragBenchmark("section", "shadow"),
  createDragBenchmark("section", "shadows"),
  createDragBenchmark("root", "shadow"),
];
