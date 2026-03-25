import { useLayoutEffect, useRef } from "react";

const getPrimaryMoveableControlBox = (hostElement) => {
  const controlBoxes = [
    ...hostElement.querySelectorAll(".moveable-control-box.canvas-moveable"),
  ];

  if (controlBoxes.length === 0) {
    return null;
  }

  return (
    controlBoxes
      .map((element) => ({
        area:
          element.getBoundingClientRect().width *
          element.getBoundingClientRect().height,
        element,
      }))
      .sort((left, right) => right.area - left.area)[0]?.element || null
  );
};

export const CanvasSelectionDragPreview = ({
  delta,
  hostElement,
  isVisible,
  zoom,
}) => {
  const previewRef = useRef(null);

  useLayoutEffect(() => {
    const previewElement = previewRef.current;

    if (!previewElement) {
      return;
    }

    previewElement.replaceChildren();

    if (!(hostElement && isVisible)) {
      return;
    }

    const sourceControlBox = getPrimaryMoveableControlBox(hostElement);

    if (!sourceControlBox) {
      return;
    }

    const clonedControlBox = sourceControlBox.cloneNode(true);
    clonedControlBox.classList.add("canvas-selection-drag-preview-box");
    previewElement.replaceChildren(clonedControlBox);

    return () => {
      previewElement.replaceChildren();
    };
  }, [hostElement, isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="canvas-selection-drag-preview pointer-events-none absolute inset-0"
      ref={previewRef}
      style={{
        transform: `translate(${delta.x * zoom}px, ${delta.y * zoom}px)`,
      }}
    />
  );
};
