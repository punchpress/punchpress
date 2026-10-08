import { useEffect, useState } from "react";

// The toolbar positions itself from DOM layout, which editor state does not
// describe. Re-render when the canvas host or its bottom toolbar resizes.
export const useToolbarAnchorLayout = (editor) => {
  const [, setLayoutRevision] = useState(0);

  useEffect(() => {
    const host = editor.hostRef;

    if (!(host && typeof ResizeObserver !== "undefined")) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setLayoutRevision((revision) => revision + 1);
    });
    const bottomToolbar = host.querySelector(".canvas-bottom-toolbar");

    observer.observe(host);

    if (bottomToolbar) {
      observer.observe(bottomToolbar);
    }

    return () => observer.disconnect();
  }, [editor]);
};
