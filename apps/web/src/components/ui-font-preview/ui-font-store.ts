import { createPreviewStore } from "../dev-preview/create-preview-store";

// Dev builds only: production must not bundle the candidate fonts.
if (import.meta.env.DEV) {
  import("../../styles/ui-font-preview.css");
}

// Dev-only UI font comparison. Each option is a `[data-ui-font]` token block
// in styles/ui-font-preview.css. Once a font is picked, its tokens become the
// :root values and this folder and that stylesheet go away.
export const uiFontStore = createPreviewStore({
  attribute: "ui-font",
  options: [
    { description: "Geist Variable (current)", id: "geist", label: "Geist" },
    {
      description: "Inter Variable with cv11, ss01, and optical sizing",
      id: "inter",
      label: "Inter",
    },
    {
      description: "SF Pro on macOS, Segoe UI Variable on Windows",
      id: "system",
      label: "System",
    },
  ],
  storageKey: "punchpress.ui-font-preview",
});
