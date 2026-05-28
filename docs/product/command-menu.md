---
summary: Defines the PunchPress command menu surface for workspace actions and custom command pages.
read_when:
  - changing Cmd+K behavior, command rows, command menu navigation, or command-specific pages like Assets
  - adding a new workspace action that should be discoverable outside persistent chrome
---

# Command Menu

The command menu is the workspace action surface opened with Cmd+K on macOS and
Ctrl+K elsewhere.

## Contract

- The menu opens over the active editor workspace.
- The default view is a searchable list of command rows.
- Selecting a command either runs the action or switches to a command-specific
  page.
- Command-specific pages can use their own result layout when rows are not the
  right shape.
- Escape closes the menu from the default view.

## Assets

Assets is the first command-specific page. It keeps the command menu shell but
uses a search bar and grid results because asset previews are visual content, not
text commands.
