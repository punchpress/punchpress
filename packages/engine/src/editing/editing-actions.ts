import { ROOT_PARENT_ID } from "@punchpress/punch-schema";
import { createDefaultArtboardNode } from "../nodes/artboard/model";
import { createDefaultPathNode } from "../nodes/path/model";
import { createDefaultNode } from "../nodes/text/model";
import { getTextNodePlacementOrigin } from "../nodes/text/text-placement";
import { getArtboardParentPatch } from "../placement/artboard-parent";
import {
  getErgonomicShapePatch,
  getErgonomicTextPatch,
} from "../placement/ergonomic-starter-size";
import {
  fitFirstAddedNode,
  shouldFitFirstAddedNode,
} from "../placement/first-add-fit";

export const addArtboardNode = (editor, point) => {
  finishEditingIfNeeded(editor);
  const defaultNode = createDefaultArtboardNode();
  let nodeId: string | null = null;
  const shouldFit = shouldFitFirstAddedNode(editor);

  editor.run(() => {
    nodeId = editor.getState().addArtboardNode(
      point || {
        x: defaultNode.transform.x,
        y: defaultNode.transform.y,
      }
    );
  });

  if (shouldFit && nodeId) {
    fitFirstAddedNode(editor, nodeId);
  }

  return nodeId;
};

export const addShapeNode = (editor, point, shape) => {
  finishEditingIfNeeded(editor);
  const resolvedShape = shape || editor.nextShapeKind;
  let nodeId: string | null = null;
  const shouldFit = shouldFitFirstAddedNode(editor);

  editor.run(() => {
    nodeId = editor.getState().addShapeNode(point, resolvedShape, {
      patch: mergePlacementPatches(
        getArtboardParentPatch(editor, point),
        getErgonomicShapePatch(editor, point, resolvedShape)
      ),
    });
  });

  if (shouldFit && nodeId) {
    fitFirstAddedNode(editor, nodeId);
  }
};

export const addTextNode = (editor, point) => {
  finishEditingIfNeeded(editor);
  const font = editor.getDefaultFont();
  const nodePatch = mergePlacementPatches(
    getArtboardParentPatch(editor, point),
    getErgonomicTextPatch(editor, point)
  );
  const shouldFit = shouldFitFirstAddedNode(editor);
  const placementOrigin = point
    ? getTextNodePlacementOrigin(
        nodePatch
          ? { ...createDefaultNode(font), ...nodePatch }
          : createDefaultNode(font),
        point,
        editor.fonts.getLoadedFont(font)
      )
    : point;

  editor.editingHistoryMark = editor.markHistoryStep("add text");
  const nodeId = editor.getState().addTextNode(placementOrigin, font, {
    patch: nodePatch,
  });

  if (shouldFit && nodeId && !point) {
    fitFirstAddedNode(editor, nodeId);
  }

  return nodeId;
};

export const addVectorNode = (editor, point) => {
  finishEditingIfNeeded(editor);
  const defaultNode = createDefaultPathNode(ROOT_PARENT_ID);
  let nodeId: string | null = null;
  const shouldFit = shouldFitFirstAddedNode(editor);

  editor.run(() => {
    nodeId = editor.getState().addVectorNode(
      point || {
        x: defaultNode.transform.x,
        y: defaultNode.transform.y,
      },
      {
        patch: getArtboardParentPatch(editor, point),
      }
    );
  });

  if (shouldFit && nodeId) {
    fitFirstAddedNode(editor, nodeId);
  }
};

export const cancelEditing = (editor) => {
  editor.getState().cancelEditing();
  commitEditingHistoryStep(editor);
  editor.getState().setActiveTool("pointer");
};

export const commitEditing = (editor) => {
  editor.getState().commitEditing();
};

export const finalizeEditing = (editor) => {
  commitEditing(editor);
  commitEditingHistoryStep(editor);
  editor.getState().setActiveTool("pointer");
};

export const setActiveTool = (editor, toolId) => {
  if (!editor.tools.has(toolId)) {
    return;
  }

  const previousToolId = editor.activeTool;

  if (toolId !== editor.activeTool) {
    editor.currentTool.onDeactivate?.({
      nextToolId: toolId,
    });
  }

  if (toolId !== "text" && editor.editingNodeId) {
    finalizeEditing(editor);
  }

  editor.getState().setActiveTool(toolId);

  if (toolId !== previousToolId) {
    editor.currentTool.onActivate?.({
      previousToolId,
    });
  }
};

export const setEditingText = (editor, value) => {
  editor.getState().setEditingText(value);
};

export const startEditing = (editor, node) => {
  if (editor.editingNodeId && editor.editingNodeId !== node.id) {
    finalizeEditing(editor);
  }

  if (!editor.editingHistoryMark) {
    editor.editingHistoryMark = editor.markHistoryStep("edit text");
  }

  editor.getState().startEditing(node);
};

export const finishEditingIfNeeded = (editor) => {
  if (!editor.editingNodeId) {
    return;
  }

  finalizeEditing(editor);
};

const commitEditingHistoryStep = (editor) => {
  if (!editor.editingHistoryMark) {
    return;
  }

  editor.commitHistoryStep(editor.editingHistoryMark);
  editor.editingHistoryMark = null;
};

const mergePlacementPatches = (...patches) => {
  const mergedPatch = Object.assign({}, ...patches.filter(Boolean));

  return Object.keys(mergedPatch).length > 0 ? mergedPatch : null;
};
