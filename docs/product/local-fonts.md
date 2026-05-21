---
summary: Defines local font access as a platform capability used by editable text, font previews, document loading, and export safety.
read_when:
  - changing browser or Electron local font access, font catalog initialization, fallback behavior, or missing-font export dialogs
  - debugging different text rendering between web, desktop, load, and export paths
---

# Local Fonts

Local fonts are a platform capability around the editor's text model.

- The editor requests available local fonts through the host platform.
- Font descriptors are stored in text nodes.
- Font bytes are loaded when rendering or export needs them.
- Missing fonts are resolved to editable fallbacks when possible.
- Export surfaces unresolved fonts before baking output.
- Browser and Electron font access should converge on the same editor-facing
  behavior.
