---
summary: Defines document behavior for `.punch` files, active tabs, open/save/save-as, import/export scope, dirty state, and editable source preservation.
read_when:
  - changing file-backed document flows, save/load behavior, dirty state, document identity, or import/export command scope
  - deciding whether behavior belongs to workspace tabs, document commands, or the `.punch` reference format
---

# Documents

PunchPress documents store editable design recipes.

## Contract

- `.punch` files preserve editable source data.
- File-backed tabs can be opened, saved, saved as, and closed.
- Save and export act on the active tab.
- Opening a file creates or focuses a file-backed tab.
- Dirty state belongs to file-backed tabs.
- Scratchpad content is not a file-backed document unless the user copies,
  exports, or saves content through normal product flows.

For exact schema, see [Punch format](../reference/punch-format.md).
