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
import { groupDragBenchmarks } from "./group-drag-benchmark";

type DiscreteActionName = "group" | "ungroup" | "reorder" | "reparent";

interface PreparedAction {
  affectedNodeIds: string[];
  // A value that must change when the action applies and come back on undo.
  probe: () => string;
  run: () => void;
}

// Selection and targets are prepared outside each measured sample.
const prepareAction = (
  editor: Editor,
  scene: GroupActionScene,
  name: DiscreteActionName
): PreparedAction => {
  const sectionIndex = getTargetSectionIndex(scene);
  const sectionId = scene.sectionIds[sectionIndex];
  const subgroupIds = editor.getChildNodeIds(sectionId);

  if (name === "group") {
    const groupedIds = subgroupIds.slice(1, 3);

    selectWithin(editor, groupedIds);

    return {
      affectedNodeIds: groupedIds,
      probe: () => `${editor.getNode(groupedIds[0])?.parentId}`,
      run: () => editor.groupSelected(),
    };
  }

  if (name === "ungroup") {
    selectWithin(editor, [sectionId]);

    return {
      affectedNodeIds: [sectionId],
      probe: () => `${Boolean(editor.getNode(sectionId))}`,
      run: () => editor.ungroup(sectionId),
    };
  }

  if (name === "reorder") {
    const bottomSectionId = scene.sectionIds[0];
    const parentId = editor.getNode(bottomSectionId)?.parentId;

    selectWithin(editor, [bottomSectionId]);

    return {
      affectedNodeIds: [bottomSectionId],
      probe: () =>
        `${editor.getChildNodeIds(parentId).indexOf(bottomSectionId)}`,
      run: () => editor.bringToFront(bottomSectionId),
    };
  }

  const clusterId = editor.getChildNodeIds(subgroupIds[0])[0];
  const targetParentId = editor.getChildNodeIds(
    scene.sectionIds[sectionIndex + 1]
  )[1];

  selectWithin(editor, [clusterId]);

  return {
    affectedNodeIds: [clusterId],
    probe: () => `${editor.getNode(clusterId)?.parentId}`,
    run: () => editor.moveNodeToParent(clusterId, targetParentId, undefined),
  };
};

const expectProbe = (label: string, actual: string, expected: string) => {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}.`);
  }
};

const runDiscreteSamples = async (
  context: PerformanceBenchmarkContext,
  scene: GroupActionScene,
  name: DiscreteActionName
) => {
  const { editor, options, waitForFrames } = context;

  for (let sample = 0; sample < options.frames; sample += 1) {
    const action = prepareAction(editor, scene, name);

    if (sample === 0) {
      recordGroupActionStats(editor, action.affectedNodeIds);
    }

    await waitForFrames(2);

    const before = action.probe();

    await runSettled(context, name, action.run);

    const after = action.probe();

    if (after === before) {
      throw new Error(`${name} did not change the document (${before}).`);
    }

    await runSettled(context, "undo", () => editor.undo());
    expectProbe(`undo ${name}`, action.probe(), before);
    await runSettled(context, "redo", () => editor.redo());
    expectProbe(`redo ${name}`, action.probe(), after);
    // Resetting is one more undo of the same entry, so it is a valid sample.
    await runSettled(context, "undo", () => editor.undo());
    expectProbe(`reset ${name}`, action.probe(), before);
  }
};

const createDiscreteBenchmark = (
  name: DiscreteActionName,
  fixture: GroupActionFixture
): PerformanceBenchmarkDefinition => {
  return {
    defaultOptions: {
      frames: 6,
      nodeCount: GROUP_ACTION_NODE_COUNT,
      stepX: 0,
      stepY: 0,
      warmupFrames: 12,
    },
    description: `Times ${name} on the ${fixture} ~4k-node imported-SVG tree, plus undo and redo of it, with command spans and action-to-settled-frame latency per sample.`,
    id: `group-actions-${name}-${fixture}`,
    label: `Group Actions: ${name} (${fixture})`,
    setup: async (context) => {
      await setupGroupActionScene(context, fixture);
    },
    run: async (context) => {
      await runDiscreteSamples(context, getGroupActionScene(context), name);
    },
    usesScratchDocument: true,
  };
};

const DISCRETE_ACTIONS: DiscreteActionName[] = [
  "group",
  "ungroup",
  "reorder",
  "reparent",
];

export const groupActionBenchmarks = [
  ...groupDragBenchmarks,
  ...(["dense", "expanded", "shadow"] as const).flatMap((fixture) => {
    return DISCRETE_ACTIONS.map((name) =>
      createDiscreteBenchmark(name, fixture)
    );
  }),
];
