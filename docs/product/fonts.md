---
summary: Defines local font behavior for text nodes, font discovery, fallback, previews, missing fonts, and export prompts.
read_when:
  - changing local font loading, default fonts, font picker previews, missing-font resolution, or export behavior with unresolved fonts
  - debugging text layout or export output that differs because a font was unavailable
---

# Fonts

PunchPress text uses local font descriptors so designs remain editable while
rendering with user-installed fonts.

## Contract

- Text nodes store font descriptors, not baked outlines.
- Font family, full name, postscript name, and style identify a local font.
- The editor can resolve default fonts for new text.
- Font previews should reflect the selected font when available.
- Missing fonts are surfaced before export when they affect output fidelity.

## Missing Fonts

- Opening and saving a document preserve every font descriptor, even before
  local font access is granted or when a font is missing.
- Unavailable text has a temporary canvas preview. When the original font
  becomes available to PunchPress, its rendering returns without changing the
  document.
- Choosing another font in Text properties permanently changes selected text.
- Export stops when a document font is unavailable, so the temporary preview
  cannot become production output.
