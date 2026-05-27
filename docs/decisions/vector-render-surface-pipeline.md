---
summary: Records the three-layer vector model: durable path/vector nodes, compiled render surfaces, and specialized edit overlays.
read_when:
  - changing vector rendering, compound paths, boolean compilation, SVG import normalization, or path-edit overlays
  - deciding whether Paper-backed helpers may participate in normal canvas rendering
  - debugging leaked backend state, stale vector render surfaces, or vector-specific overlay special cases
---

# Vector Render Surface Pipeline

Status: Accepted
Date: 2026-04-21

## Context

Vector work exposed a recurring leak between:

- durable vector document nodes
- compiled render output shown on canvas
- transient path-edit backend state

When these layers blur, vector special cases spread across rendering, queries,
selection, and overlays.

## Decision

PunchPress keeps three explicit layers for vector artwork.

| Layer | Ownership |
| --- | --- |
| Durable document nodes | `path` nodes own geometry and styling; `vector` nodes own child-path composition. Imported SVGs normalize into editable groups and paths. |
| Compiled render surfaces | Engine-derived SVG-ready output used for normal canvas rendering. |
| Specialized edit overlays | Paper-backed path editing and related transient interaction state. |

Outside edit mode, React paints vector output as one normal-mode surface. That
surface may be derived from child paths or from a dense subtree cache. Compiled
surfaces are derived state, not saved document state.

Paper-backed helpers are allowed only in:

- the dedicated path-edit overlay
- explicit boolean or compound compilation work
- SVG import normalization

They are not the ordinary render path and not the source of truth for saved
vector data.

## Overlay Direction

Vector editing may have a specialized edit overlay. It does not get a separate
general-purpose hover, selection, or transform architecture.

New vector features should extend shared node capability surfaces for render
geometry, frames, hit geometry, indicators, and edit affordance geometry.

## Consequences

- Normal vector rendering stays SVG output driven by engine-owned surfaces.
- Whole-object transforms prefer shell movement and shared preview transforms.
- Backend-specific state stays inside the edit overlay boundary.
- Vector features do not scatter special-case behavior through unrelated canvas
  modules.
