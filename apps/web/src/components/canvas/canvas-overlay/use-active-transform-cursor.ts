import { useEffect } from "react";

export const useActiveTransformCursor = (cursor: string | null) => {
  useEffect(() => {
    if (!(cursor && typeof document !== "undefined")) {
      return;
    }

    const previousCursor = document.body.style.getPropertyValue(
      "--active-transform-cursor"
    );
    const previousState = document.body.dataset.activeTransformCursor;
    document.body.dataset.activeTransformCursor = "true";
    document.body.style.setProperty("--active-transform-cursor", cursor);

    return () => {
      if (
        document.body.style.getPropertyValue("--active-transform-cursor") ===
        cursor
      ) {
        if (previousCursor) {
          document.body.style.setProperty(
            "--active-transform-cursor",
            previousCursor
          );
        } else {
          document.body.style.removeProperty("--active-transform-cursor");
        }
      }

      if (previousState) {
        document.body.dataset.activeTransformCursor = previousState;
      } else {
        delete document.body.dataset.activeTransformCursor;
      }
    };
  }, [cursor]);
};
