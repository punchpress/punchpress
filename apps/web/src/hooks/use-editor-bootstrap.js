import { FALLBACK_FONTS, UI_ACCENT } from "../editor/constants";

export const useEditorBootstrap = () => {
  return {
    fonts: FALLBACK_FONTS,
    accent: UI_ACCENT,
    bootstrapState: "ready",
    bootstrapError: "",
  };
};
