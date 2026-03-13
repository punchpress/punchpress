import { getRotatedNodeUpdate } from "../../../editor/primitives/rotation";
import {
  getNodeRotation,
  getNodeX,
  getNodeY,
} from "../../../editor/shapes/warp-text/model";
import { getSelectionCenter } from "./canvas-overlay-geometry";

export const updateSingleNodeRotation = (editor, selectedNode, event) => {
  if (
    !(
      selectedNode &&
      event.datas.baseNode &&
      event.datas.baseBBox &&
      event.datas.selectionCenter
    )
  ) {
    return;
  }

  editor.updateNode(
    selectedNode.id,
    getRotatedNodeUpdate(
      event.datas.baseNode,
      event.datas.baseBBox,
      event.datas.selectionCenter,
      event.beforeDist
    )
  );
};

export const updateGroupRotation = (editor, visibleSelectedNodeIds, event) => {
  const baseNodes = event.datas.baseNodes;
  const selectionCenter = event.datas.selectionCenter;

  if (!(baseNodes && selectionCenter)) {
    return;
  }

  editor.updateNodes(visibleSelectedNodeIds, (node) => {
    const baseNode = baseNodes.get(node.id);

    if (!baseNode) {
      return node;
    }

    return getRotatedNodeUpdate(
      baseNode,
      baseNode.bbox,
      selectionCenter,
      event.beforeDist
    );
  });
};

const buildRotateSelectionCenter = (bbox, selectedNode) => {
  return getSelectionCenter({
    height: bbox.height,
    maxX: getNodeX(selectedNode) + bbox.maxX,
    maxY: getNodeY(selectedNode) + bbox.maxY,
    minX: getNodeX(selectedNode) + bbox.minX,
    minY: getNodeY(selectedNode) + bbox.minY,
    width: bbox.width,
  });
};

export const setRotateStartState = (event, selectedNode, bbox) => {
  event.set(getNodeRotation(selectedNode) || 0);
  event.datas.baseBBox = bbox;
  event.datas.baseNode = {
    ...selectedNode,
  };
  event.datas.selectionCenter = buildRotateSelectionCenter(bbox, selectedNode);
};
