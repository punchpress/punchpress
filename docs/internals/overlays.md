---
summary: Explains the centralized canvas overlay system for selection chrome, transform handles, hover previews, text guides, vector path editing, toolbar presence, and visuals.
read_when:
  - changing `apps/web/src/components/canvas/canvas-overlay`, overlay queries, selection chrome, transform handles, text path guides, or vector path chrome
  - debugging overlay alignment, stale hover previews, hidden path ghosts, or jitter during transforms
---

# Overlay System

Overlays communicate selection, hover, editing, and direct manipulation above
artwork.

## Layers

- host overlays attach to viewport/host surfaces
- stage overlays attach to canvas/world surfaces
- selection overlays draw single and multi-selection chrome
- text overlays draw path guides and handles
- vector overlays host specialized Paper-backed path editing
- toolbar overlays position contextual actions
- shared visuals provide guide, ghost, handle, and indicator treatments

## Rules

- The engine exposes overlay query state.
- React renders overlay visuals and handles browser interaction.
- Overlay style stays centralized.
- Specialized edit overlays do not justify separate hover, selection, or
  transform architectures.
- Repeated visual roles use shared semantic overlay tokens and primitives, not
  per-feature restyling.
- Feature overlays own behavior and geometry; shared visual primitives own
  repeated guide, ghost, handle, indicator, and warning treatments.
- Paper-backed vector chrome remains specialized for geometry and interaction,
  but it should consume the same semantic visual vocabulary as the rest of the
  overlay stack.

## Visual Extension Surface

New overlay affordances should choose one of three paths:

| Need | Extension point |
| --- | --- |
| Another instance of an existing role | Reuse the shared visual primitive. |
| A new role in the same family | Add a semantic token and primitive before wiring feature chrome. |
| A genuinely specialized editor backend | Keep backend logic specialized, but map its visible states to shared overlay tokens where possible. |
