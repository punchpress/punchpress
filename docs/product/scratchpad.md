---
summary: Defines the always-present PunchPress scratchpad as local autosaved internal document storage outside normal file and recent-document flows.
read_when:
  - changing scratchpad persistence, autosave timing, tab behavior, reset behavior, or unsaved-change prompts
  - debugging scratchpad data loss, accidental recent-document entries, or save/open interactions
---

# Scratchpad

The scratchpad is the default local workspace.

- It is always present.
- It autosaves without prompting.
- It has a tab and cannot be closed.
- It is internal local storage, not a user-selected `.punch` file.
- It does not appear in recent documents.
- It does not participate in save, save-as, open, close, or unsaved-change
  prompts.
- Clearing it is explicit.

See [Workspace tabs](workspace-tabs.md).
