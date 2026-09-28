---
summary: Explains local font discovery, font catalog state, font byte loading, default font resolution, preview state, and missing-font export safeguards.
read_when:
  - changing font manager behavior, local font platform adapters, font picker previews, default font resolution, or missing-font dialogs
  - debugging mismatched text layout between load, edit, render, and export paths
---

# Font Loading

Fonts cross platform and engine boundaries.

## Flow

1. Platform lists local fonts from browser `queryLocalFonts` or Electron.
2. Engine stores a local font catalog and resolves defaults.
3. Text nodes reference local font descriptors.
4. Font bytes load when geometry, preview, or export needs them.
5. Unloaded text uses a canvas-only preview until its original font bytes load.
6. Unresolved fonts block export when output fidelity would change.

## Rules

- Text remains editable even when a font is missing.
- Document load never substitutes a font descriptor. Only an explicit text
  property change does that.
- Catalog state distinguishes unrequested or denied access from a ready catalog
  that confirms a missing font. A later catalog update preloads original fonts
  and invalidates text geometry without changing document history.
- Preview text is never used by the export path.
- React font pickers consume engine font state; they do not own font resolution.
