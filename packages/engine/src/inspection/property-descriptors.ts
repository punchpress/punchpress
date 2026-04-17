import { getNodeX, getNodeY } from "../nodes/text/model";
import {
  areCornerRadiiEquivalent,
  clampCornerRadius,
} from "../primitives/corner-radius";
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

const heightDescriptor = createPropertyDescriptor({
  getValue: (node) => node.height,
  id: "height",
  setValue: (_node, value) => ({ height: value }),
});

const cornerRadiusDescriptor = createPropertyDescriptor({
  getValue: (node) => clampCornerRadius(node.cornerRadius ?? 0),
  id: "cornerRadius",
  isEqual: areCornerRadiiEquivalent,
  setValue: (_node, value) => ({
    cornerRadius: clampCornerRadius(value),
  }),
});

const shapeDescriptor = createPropertyDescriptor({
  getValue: (node) => node.shape,
  id: "shape",
  setValue: (_node, value) => ({ shape: value }),
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
  setValue: (_node, value) => ({ width: value }),
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
