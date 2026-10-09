import { PreviewSwitcher } from "../dev-preview/preview-switcher";
import { panelContainerStore } from "./panel-container-store";

// Dev-only. Alt+Shift+P cycles the pane container direction.
export const PanelContainerSwitcher = () => {
  return (
    <PreviewSwitcher hotkey="P" label="Panels" store={panelContainerStore} />
  );
};
