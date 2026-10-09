import { PreviewSwitcher } from "../dev-preview/preview-switcher";
import { uiFontStore } from "./ui-font-store";

// Dev-only. Alt+Shift+F cycles the UI font.
export const UiFontSwitcher = () => {
  return <PreviewSwitcher hotkey="F" label="Font" store={uiFontStore} />;
};
