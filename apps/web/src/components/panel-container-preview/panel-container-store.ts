import { createPreviewStore } from "../dev-preview/create-preview-store";

// Dev-only comparison of the Layers and Properties pane containers. Each
// option is a `[data-panel-container]` token block in
// styles/panel-container-preview.css; the shell, panes, and canvas read only
// the `--shell-*` and `--pane-*` tokens. Once a direction is picked, its
// tokens become the :root values in panel-container.css and this folder and
// the preview stylesheet go away.
if (import.meta.env.DEV) {
  import("../../styles/panel-container-preview.css");
}

export const panelContainerStore = createPreviewStore({
  attribute: "panel-container",
  options: [
    {
      description: "Today's floating cards",
      id: "floating",
      label: "Floating",
    },
    {
      description: "Tighter, flatter floating cards with hairline borders",
      id: "refined",
      label: "Refined",
    },
    {
      description: "Full-height docked sidebars, edge to edge",
      id: "docked",
      label: "Docked",
    },
    {
      description: "Docked sidebars around an inset, rounded canvas",
      id: "inset",
      label: "Inset",
    },
  ],
  storageKey: "punchpress.panel-container-preview",
});
