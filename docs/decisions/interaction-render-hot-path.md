---
summary: Defines PunchPress hot-path rendering rules for active transforms, transient previews, DOM writes, React fanout, and zoom-safe coordinate handling.
read_when:
  - changing drag, resize, rotate, selection preview, overlay motion, or render performance paths
  - investigating frame cost during active pointer interactions
  - deciding whether to optimize React renders, DOM writes, visual simplification, or culling
---

# Interaction Render Hot Path

Status: Accepted
Date: 2026-03-24

## Context

PunchPress must stay responsive while many nodes are visible and while large
selections move.

Even with a clean node model, hot interactions can regress if every drag tick
fans out through too many DOM writes, React renders, or document mutations.

## Decision

Hot interaction rendering follows these rules:

- durable document state and transient interaction preview stay separate
- node content and node placement stay separate
- active placement updates the smallest possible shell surface
- hot-path visual motion writes to the smallest possible number of DOM surfaces
- React composes the surfaces but should not be the per-frame bottleneck
- coordinate spaces are explicit: canvas, viewport, screen, and zoomed
  screen-space values cannot be mixed implicitly
- dense visible sets should degrade by simpler visual representation before
  they degrade by latency

## Preferred Shape

For active transforms:

1. Document state remains stable.
2. The editor exposes transient preview state.
3. The canvas applies preview through the cheapest placement layer.
4. Durable transforms commit once at gesture end.

Prefer stable node shells, stable node art, centralized placement updates, and
editor-owned overlays.

Avoid rerendering node content during drag or using DOM-target-driven
third-party transform overlays on the hot path.

## Performance Order

When performance work is needed:

1. reduce hot-path DOM writes
2. reduce React updates needed for motion
3. simplify visual representation for dense or tiny content
4. cull offscreen content

Viewport culling matters, but it is not a substitute for cheap active motion.
