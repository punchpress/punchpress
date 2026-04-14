import {
  DEFAULT_VECTOR_STROKE_LINE_CAP,
  DEFAULT_VECTOR_STROKE_LINE_JOIN,
  DEFAULT_VECTOR_STROKE_MITER_LIMIT,
} from "@punchpress/punch-schema";

const createStyleDescriptor = ({
  id,
  scopes = ["single", "multi"],
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

export const fillStyleDescriptor = createStyleDescriptor({
  getValue: (node) => node.fill,
  id: "fill",
  setValue: (_node, value) => ({ fill: value }),
});

export const fillRuleStyleDescriptor = createStyleDescriptor({
  getValue: (node) => node.fillRule,
  id: "fillRule",
  setValue: (_node, value) => ({ fillRule: value }),
});

export const strokeStyleDescriptor = createStyleDescriptor({
  getValue: (node) => node.stroke,
  id: "stroke",
  setValue: (_node, value) => ({ stroke: value }),
});

export const strokeLineCapStyleDescriptor = createStyleDescriptor({
  getValue: (node) => node.strokeLineCap ?? DEFAULT_VECTOR_STROKE_LINE_CAP,
  id: "strokeLineCap",
  setValue: (_node, value) => ({ strokeLineCap: value }),
});

export const strokeLineJoinStyleDescriptor = createStyleDescriptor({
  getValue: (node) => node.strokeLineJoin ?? DEFAULT_VECTOR_STROKE_LINE_JOIN,
  id: "strokeLineJoin",
  setValue: (_node, value) => ({ strokeLineJoin: value }),
});

export const strokeMiterLimitStyleDescriptor = createStyleDescriptor({
  getValue: (node) => node.strokeMiterLimit ?? DEFAULT_VECTOR_STROKE_MITER_LIMIT,
  id: "strokeMiterLimit",
  setValue: (_node, value) => ({
    strokeMiterLimit: Math.max(0, value),
  }),
});

export const strokeWidthStyleDescriptor = createStyleDescriptor({
  getValue: (node) => node.strokeWidth,
  id: "strokeWidth",
  setValue: (_node, value) => ({ strokeWidth: value }),
});
