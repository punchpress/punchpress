interface PixelGridStrokeWidthOptions {
  devicePixelRatio: number;
  scaleX: number;
  scaleY: number;
  zoom: number;
}

interface PixelGridSampleSize {
  height: number;
  width: number;
}

interface PixelGridPlaneNode {
  baseHeight?: number;
  baseWidth?: number;
  baseX?: number;
  baseY?: number;
}

export const getPixelGridPlane = (
  node: PixelGridPlaneNode,
  sampleSize: PixelGridSampleSize
) => ({
  cellHeight:
    (node.baseHeight ?? sampleSize.height) / Math.max(1, sampleSize.height),
  cellWidth:
    (node.baseWidth ?? sampleSize.width) / Math.max(1, sampleSize.width),
  originX: node.baseX ?? 0,
  originY: node.baseY ?? 0,
});

export const getPixelGridPreviewNode = (node, preview) => {
  if (!preview?.nodeIds?.includes(node.id)) {
    return node;
  }

  if (preview.resize?.nodeUpdate) {
    return {
      ...node,
      ...preview.resize.nodeUpdate,
      transform: {
        ...node.transform,
        ...(preview.resize.nodeUpdate.transform || {}),
      },
    };
  }

  if (Number.isFinite(preview.resize?.scale) && preview.resize?.anchorCanvas) {
    if (
      preview.effectiveNodeIdSet &&
      !preview.effectiveNodeIdSet.has(node.id)
    ) {
      return node;
    }

    const scale = preview.resize.scale;
    const anchor = preview.resize.anchorCanvas;
    const centerX = (node.transform?.x || 0) + node.width / 2;
    const centerY = (node.transform?.y || 0) + node.height / 2;

    return {
      ...node,
      transform: {
        ...node.transform,
        scaleX: (node.transform?.scaleX ?? 1) * scale,
        scaleY: (node.transform?.scaleY ?? 1) * scale,
        x: anchor.x + (centerX - anchor.x) * scale - node.width / 2,
        y: anchor.y + (centerY - anchor.y) * scale - node.height / 2,
      },
    };
  }

  if (!preview.delta) {
    return node;
  }

  return {
    ...node,
    transform: {
      ...node.transform,
      x: (node.transform?.x || 0) + preview.delta.x,
      y: (node.transform?.y || 0) + preview.delta.y,
    },
  };
};

export const getPixelGridStrokeWidths = ({
  devicePixelRatio,
  scaleX,
  scaleY,
  zoom,
}: PixelGridStrokeWidthOptions) => {
  const physicalScale =
    Math.max(devicePixelRatio, 0.001) * Math.max(zoom, 0.001);

  return {
    horizontal: 1 / (physicalScale * Math.max(Math.abs(scaleY), 0.001)),
    vertical: 1 / (physicalScale * Math.max(Math.abs(scaleX), 0.001)),
  };
};
