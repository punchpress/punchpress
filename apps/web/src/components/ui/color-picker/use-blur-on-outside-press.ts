import { type RefObject, useEffect } from "react";

// Surfaces such as the canvas prevent default on pointerdown, which stops the
// browser from moving focus. Blur the focused field ourselves so its normal
// blur commit runs before the outside press is handled.
export const useBlurOnOutsidePress = (
  ref: RefObject<HTMLInputElement | null>
) => {
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const element = ref.current;

      if (
        !element ||
        element !== document.activeElement ||
        (event.target instanceof Node && element.contains(event.target))
      ) {
        return;
      }

      element.blur();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [ref]);
};
