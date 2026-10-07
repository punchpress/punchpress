export const fillRuleStyleDescriptor = {
  getValue: (node) => node.fillRule,
  id: "fillRule",
  isEqual: Object.is,
  scopes: ["single", "multi"],
  setValue: (_node, value) => ({ fillRule: value }),
};
