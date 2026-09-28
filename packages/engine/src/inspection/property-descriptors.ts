import { getNodeX, getNodeY } from "../nodes/text/model";
import { getImageNodeBounds } from "../nodes/image/image-capabilities";
import { getShapeCornerRadiusSummary } from "../nodes/shape/shape-engine";
import {
  areCornerRadiiEquivalent,
  clampCornerRadius,
} from "../primitives/corner-radius";
import { getScaledImageNodeUpdate } from "../primitives/group-resize";
import {
  getNodeTransformForPinnedWorldPoint,
  getNodeWorldPoint,
} from "../primitives/rotation";
import {
  fillRuleStyleDescriptor,
  fillStyleDescriptor,
  strokeLineCapStyleDescriptor,
  strokeLineJoinStyleDescriptor,
  strokeMiterLimitStyleDescriptor,
  strokeStyleDescriptor,
  strokeWidthStyleDescriptor,
} from "../styles/style-descriptors";

const createPropertyDescriptor = ({
  id,
  scopes = ["single"],
  getValue,
  setValue,
  isEqual = Object.is,
}) => {
  return {
    getValue,
    id,
    isEqual,
    scopes,
    setValue,
  };
};

const backgroundDescriptor = createPropertyDescriptor({
  getValue: (node) => node.background,
  id: "background",
  scopes: ["single", "multi"],
  setValue: (_node, value) => ({ background: value }),
});

const fontDescriptor = createPropertyDescriptor({
  getValue: (node) => node.font,
  id: "font",
  isEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
  setValue: (_node, value) => ({ font: value }),
});

const fontSizeDescriptor = createPropertyDescriptor({
  getValue: (node) => node.fontSize,
  id: "fontSize",
  setValue: (_node, value) => ({ fontSize: value }),
});

const setImageDimensionFromCenter = (node, propertyId, value) => {
  if (node?.type !== "image") {
    return { [propertyId]: value };
  }

  const bounds = getImageNodeBounds(node);
  const pinnedWorldPoint = getNodeWorldPoint(node, bounds, {
    x: bounds.width / 2,
    y: bounds.height / 2,
  });
  const nodeUpdate = getScaledImageNodeUpdate(
    node,
    propertyId === "width" ? value / node.width : 1,
    propertyId === "height" ? value / node.height : 1
  );
  const nextNode = {
    ...node,
    ...nodeUpdate,
  };
  const nextBounds = getImageNodeBounds(nextNode);
  const transform = getNodeTransformForPinnedWorldPoint(
    nextNode,
    nextBounds,
    {
      x: nextBounds.width / 2,
      y: nextBounds.height / 2,
    },
    pinnedWorldPoint
  );

  return {
    ...nodeUpdate,
    transform,
  };
};

const heightDescriptor = createPropertyDescriptor({
  getValue: (node) => node.height,
  id: "height",
  setValue: (node, value) => setImageDimensionFromCenter(node, "height", value),
});

const cornerRadiusDescriptor = createPropertyDescriptor({
  getValue: (node) => clampCornerRadius(node.cornerRadius ?? 0),
  id: "cornerRadius",
  isEqual: areCornerRadiiEquivalent,
  setValue: (_node, value) => ({
    cornerRadii: undefined,
    cornerRadius: clampCornerRadius(value),
  }),
});

const shapeDescriptor = createPropertyDescriptor({
  getValue: (node) => node.shape,
  id: "shape",
  setValue: (node, value) => {
    const patch = {
      cornerRadii: undefined,
      shape: value,
    };
    const cornerSummary = getShapeCornerRadiusSummary({
      ...node,
      ...patch,
    });

    if (!cornerSummary) {
      return patch;
    }

    return {
      ...patch,
      cornerRadius: clampCornerRadius(
        node.cornerRadius ?? 0,
        0,
        cornerSummary.max
      ),
    };
  },
});

const textDescriptor = createPropertyDescriptor({
  getValue: (node) => node.text,
  id: "text",
  setValue: (_node, value) => ({ text: value }),
});

const trackingDescriptor = createPropertyDescriptor({
  getValue: (node) => node.tracking,
  id: "tracking",
  setValue: (_node, value) => ({ tracking: value }),
});

const warpDescriptor = createPropertyDescriptor({
  getValue: (node) => node.warp,
  id: "warp",
  isEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
  setValue: (_node, value) => ({ warp: value }),
});

const widthDescriptor = createPropertyDescriptor({
  getValue: (node) => node.width,
  id: "width",
  setValue: (node, value) => setImageDimensionFromCenter(node, "width", value),
});

const xDescriptor = createPropertyDescriptor({
  getValue: (node) => getNodeX(node),
  id: "x",
  setValue: (_node, value) => ({
    transform: {
      x: value,
    },
  }),
});

const yDescriptor = createPropertyDescriptor({
  getValue: (node) => getNodeY(node),
  id: "y",
  setValue: (_node, value) => ({
    transform: {
      y: value,
    },
  }),
});

const PROPERTY_DESCRIPTORS = {
  background: backgroundDescriptor,
  cornerRadius: cornerRadiusDescriptor,
  fill: fillStyleDescriptor,
  fillRule: fillRuleStyleDescriptor,
  font: fontDescriptor,
  fontSize: fontSizeDescriptor,
  height: heightDescriptor,
  shape: shapeDescriptor,
  stroke: strokeStyleDescriptor,
  strokeLineCap: strokeLineCapStyleDescriptor,
  strokeLineJoin: strokeLineJoinStyleDescriptor,
  strokeMiterLimit: strokeMiterLimitStyleDescriptor,
  strokeWidth: strokeWidthStyleDescriptor,
  text: textDescriptor,
  tracking: trackingDescriptor,
  warp: warpDescriptor,
  width: widthDescriptor,
  x: xDescriptor,
  y: yDescriptor,
};

export const getPropertyDescriptor = (propertyId) => {
  return PROPERTY_DESCRIPTORS[propertyId] || null;
};
