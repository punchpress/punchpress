import { useCallback, useRef } from "react";
import { useEditor } from "../../../editor-react/use-editor";

// Render-layer presentation wrappers by node id, per editor. They are not hit
// targets, so they stay out of the editor's node-element registry.
const elementsByEditor = new WeakMap<object, Map<string, HTMLElement>>();

const getElements = (editor) => {
  let elements = elementsByEditor.get(editor);

  if (!elements) {
    elements = new Map();
    elementsByEditor.set(editor, elements);
  }

  return elements;
};

export const getPresentationElement = (editor, nodeId: string) => {
  return getElements(editor).get(nodeId) ?? null;
};

export const usePresentationElementRef = (nodeId: string) => {
  const editor = useEditor();
  const mounted = useRef<HTMLElement | null>(null);

  return useCallback(
    (element: HTMLElement | null) => {
      const elements = getElements(editor);

      if (element) {
        elements.set(nodeId, element);
      } else if (elements.get(nodeId) === mounted.current) {
        // Only this wrapper's own entry; a remount may already own the id.
        elements.delete(nodeId);
      }

      mounted.current = element;
    },
    [editor, nodeId]
  );
};
