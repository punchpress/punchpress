import type { Editor } from "@punchpress/engine";
import type { PerformanceBenchmarkContext } from "../performance-benchmark-types";
import {
  type GroupActionFixture,
  type GroupActionScene,
  loadGroupActionScene,
  showWholeArtboard,
} from "./group-action-benchmark-scene";

export const GROUP_ACTION_NODE_COUNT = 4000;

// An inner section of the 4 × 4 grid, or the second of the dense 2 × 2 grid.
export const getTargetSectionIndex = (scene: GroupActionScene) => {
  return scene.sectionIds.length > 4 ? 5 : 1;
};

// Selecting inside a group needs that group focused, as a user drills in.
export const selectWithin = (editor: Editor, nodeIds: string[]) => {
  const parentId = editor.getNode(nodeIds[0])?.parentId;

  editor.setFocusedGroup(editor.isGroupNode(parentId) ? parentId : null);
  editor.setSelectedNodes(nodeIds);

  if (editor.selectedNodeIds.join() !== nodeIds.join()) {
    throw new Error(`Unable to select ${nodeIds.join(", ")}.`);
  }
};

// Time from the command to the second following frame: the first frame runs
// React and placement work the command scheduled, the second starts once that
// frame has been produced.
export const runSettled = async (
  { recordMetric, waitForFrame }: PerformanceBenchmarkContext,
  label: string,
  run: () => void
) => {
  const startedAt = performance.now();

  run();
  await waitForFrame();
  await waitForFrame();
  recordMetric(`${label}.settleMs`, performance.now() - startedAt);
};

const sceneByEditor = new WeakMap<Editor, GroupActionScene>();

export const getGroupActionScene = ({
  editor,
}: PerformanceBenchmarkContext) => {
  const scene = sceneByEditor.get(editor);

  if (!scene) {
    throw new Error("The group action scene was not set up.");
  }

  return scene;
};

export const setupGroupActionScene = async (
  { editor, options, waitForFrame, waitForFrames }: PerformanceBenchmarkContext,
  fixture: GroupActionFixture
) => {
  const scene = await loadGroupActionScene(
    editor,
    { fixture, nodeCount: options.nodeCount },
    waitForFrame
  );

  sceneByEditor.set(editor, scene);
  showWholeArtboard(editor, scene.artboardId);
  editor.clearSelection();
  await waitForFrames(4);

  return scene;
};
