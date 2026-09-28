import {
  getNodeLocalMatrix,
  getRasterPixelFootprint,
  multiplyMatrix,
  type RasterPixelFootprintOptions,
} from "@punchpress/engine";
import { getPixelGridPreviewNode } from "../canvas-pixel-grid-math";

const LOCAL_BOUNDS = {
  height: 0,
  maxX: 0,
  maxY: 0,
  minX: 0,
  minY: 0,
  width: 0,
};

interface RasterPresentationFootprintOptions
  extends Omit<RasterPixelFootprintOptions, "scaleX" | "scaleY"> {
  nodeId: string;
  renderRootNodeId?: string;
}

export const getRasterPresentationNode = (editor, nodeId) => {
  const node = editor.getNode(nodeId);
  const preview = editor.selectionDragPreview;

  return node && preview?.resize?.nodeUpdate
    ? getPixelGridPreviewNode(node, preview)
    : node;
};

export const getRasterRenderScale = (
  editor,
  nodeId,
  renderRootNodeId = nodeId
) => {
  let node = editor.getNode(nodeId);
  const presentationNode = node
    ? getRasterPresentationNode(editor, node.id)
    : null;

  if (!presentationNode) {
    return { x: 1, y: 1 };
  }

  const renderChain = [presentationNode];

  while (node && node.id !== renderRootNodeId) {
    const parent =
      node.parentId && node.parentId !== "root"
        ? editor.getNode(node.parentId)
        : null;

    if (parent?.type !== "group") {
      break;
    }

    node = parent;
    renderChain.unshift(getRasterPresentationNode(editor, node.id));
  }

  if (node?.id !== renderRootNodeId) {
    renderChain.splice(0, renderChain.length - 1);
  }

  const matrix = renderChain.reduce(
    (currentMatrix, renderNode) =>
      multiplyMatrix(
        currentMatrix,
        getNodeLocalMatrix(renderNode, LOCAL_BOUNDS)
      ),
    { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
  );

  const previewScale = getRenderSurfacePreviewScale(
    editor.selectionDragPreview,
    renderRootNodeId
  );

  return {
    x: Math.hypot(matrix.a, matrix.b) * previewScale,
    y: Math.hypot(matrix.c, matrix.d) * previewScale,
  };
};

export const getRasterPresentationFootprint = (
  editor,
  {
    displayedHeight,
    displayedWidth,
    nodeId,
    renderRootNodeId = nodeId,
    sampleHeight,
    sampleWidth,
    zoom,
  }: RasterPresentationFootprintOptions
) => {
  const scale = getRasterRenderScale(editor, nodeId, renderRootNodeId);

  return getRasterPixelFootprint({
    displayedHeight,
    displayedWidth,
    sampleHeight,
    sampleWidth,
    scaleX: scale.x,
    scaleY: scale.y,
    zoom,
  });
};

const getRenderSurfacePreviewScale = (preview, renderRootNodeId) => {
  const scale = preview?.resize?.scale;

  if (
    !(
      Number.isFinite(scale) &&
      (preview.nodeIds?.includes(renderRootNodeId) ||
        preview.effectiveNodeIdSet?.has(renderRootNodeId))
    )
  ) {
    return 1;
  }

  return Math.abs(scale);
};
