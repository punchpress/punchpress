import paper from "paper";
import { createPaperSessionChromeController } from "./paper-session-chrome";
import { createPaperSessionSceneController } from "./paper-session-scene";
import {
  createVectorPaperSessionState,
  type VectorPaperSessionOptions,
} from "./paper-session-state";
import { createPaperSessionToolController } from "./paper-session-tool";

export const createVectorPaperSession = ({
  canvas,
  editor,
  nodeId,
  onChange,
  onExitPathEditing,
  onHistoryCommit,
  onHistoryStart,
}: VectorPaperSessionOptions) => {
  const scope = new paper.PaperScope();
  scope.setup(canvas);

  const state = createVectorPaperSessionState(scope);
  const chrome = createPaperSessionChromeController({
    canvas,
    editor,
    nodeId,
    onChange,
    scope,
    state,
  });
  const scene = createPaperSessionSceneController({
    chrome,
    scope,
    state,
  });
  const tool = createPaperSessionToolController({
    chrome,
    editor,
    nodeId,
    onExitPathEditing,
    onHistoryCommit,
    onHistoryStart,
    scene,
    scope,
    state,
  });

  return {
    destroy: () => {
      scene.clearScene();
      tool.destroy();
    },
    render: (nextScene) => {
      if (!nextScene) {
        scene.clearScene();
        tool.resetInteractionChrome();
        return;
      }

      scene.render(nextScene);
    },
  };
};
