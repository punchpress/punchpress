import { useEffect } from "react";
import { isInputElement } from "../editor/dom-utils";

export const useSpacePan = (setSpacePressed, spacePressedRef) => {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code !== "Space" || isInputElement(event.target)) {
        return;
      }

      spacePressedRef.current = true;
      setSpacePressed(true);
      event.preventDefault();
    };

    const onKeyUp = (event) => {
      if (event.code !== "Space") {
        return;
      }

      spacePressedRef.current = false;
      setSpacePressed(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [setSpacePressed, spacePressedRef]);
};
