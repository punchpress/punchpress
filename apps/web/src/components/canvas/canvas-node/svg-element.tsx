import type { SvgElement } from "@punchpress/engine";
import { createElement } from "react";

// Renders an engine SvgElement as React elements. SVG presentation
// attributes are kebab-case in markup and camelCase in React; `mask-type`
// has no React attribute, so it goes through style.
export const renderSvgElement = (element: SvgElement) => {
  const props: Record<string, unknown> = { key: element.key };

  for (const [name, value] of Object.entries(element.attributes)) {
    if (name === "mask-type") {
      props.style = { maskType: value };
    } else {
      props[toReactPropName(name)] = value;
    }
  }

  if (element.tag === "path") {
    props.pointerEvents = "none";
  }

  return createElement(
    element.tag,
    props,
    ...(element.children ?? []).map(renderSvgElement)
  );
};

const toReactPropName = (name: string) => {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
};
