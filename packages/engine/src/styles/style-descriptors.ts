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

export const strokeStyleDescriptor = createStyleDescriptor({
  getValue: (node) => node.stroke,
  id: "stroke",
  setValue: (_node, value) => ({ stroke: value }),
});

export const strokeWidthStyleDescriptor = createStyleDescriptor({
  getValue: (node) => node.strokeWidth,
  id: "strokeWidth",
  setValue: (_node, value) => ({ strokeWidth: value }),
});
