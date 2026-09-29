---
summary: Defines local font access as a platform capability used by editable text, font previews, document loading, and export safety.
read_when:
  - changing browser or Electron local font access, font catalog initialization, fallback behavior, or missing-font export dialogs
  - debugging different text rendering between web, desktop, load, and export paths
---

# Local Fonts

Local fonts are a platform capability around the editor's text model.

- The editor requests available local fonts through the host platform.
- The editor ships Source Sans Pro as a bundled default so new text can render
  and export without local-font permission.
- Font descriptors are stored in text nodes.
- Font bytes are loaded when rendering or export needs them.
- Browser font access can be unrequested, denied, unsupported, or ready. An
  unqueried catalog does not prove that an installed font is missing.
- A successful desktop font scan produces a ready catalog. A failed scan leaves
  availability unknown.
- Unavailable fonts use a temporary canvas preview while their saved
  descriptors remain intact. The Text panel explains whether access is needed
  or the font is confirmed missing. Font-dependent warp controls stay disabled
  until the saved font is available.
- Export blocks unresolved fonts before baking output.
- Browser and Electron font access should converge on the same editor-facing
  behavior.
