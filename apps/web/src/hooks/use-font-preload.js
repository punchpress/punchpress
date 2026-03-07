import { useEffect } from "react";
import { ensureFontLoaded } from "../editor/font-cache";

export const useFontPreload = (fontCacheRef, fonts, nodes, setFontRevision) => {
  useEffect(() => {
    const urls = new Set();

    for (const font of fonts) {
      urls.add(font.url);
    }

    for (const node of nodes) {
      urls.add(node.fontUrl);
    }

    for (const url of urls) {
      ensureFontLoaded(url, fontCacheRef, () => {
        setFontRevision((current) => current + 1);
      });
    }
  }, [fontCacheRef, fonts, nodes, setFontRevision]);
};
