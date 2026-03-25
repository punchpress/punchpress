# 0006: Interaction Render Hot Path

Status: Accepted

Date: 2026-03-24

## Context

PunchPress needs a rendering model that stays responsive while many nodes are
visible and while large selections are moving.

The editor already has a durable node contract for geometry, render frames, and
selection frames. The next risk is letting hot interactions drift back toward a
model where every drag tick fans out through too many DOM updates, React
renders, or document mutations.

That path does not scale, even if the node model itself is clean.

## Decision

Hot interaction rendering must follow these rules:

- durable document state and transient interaction preview stay separate
- node content and node placement stay separate
- active placement should update the smallest possible shell surface rather than
  rerendering node content
- hot-path visual motion should update the smallest possible number of DOM
  surfaces
- React may compose the surfaces, but it should not be the bottleneck for
  per-frame motion
- coordinate spaces must stay explicit; canvas-space, viewport-space, and zoomed
  screen-space transforms cannot be mixed implicitly
- large visible sets should degrade by simpler visual representation before they
  degrade by latency

## Rendering Principles

For active transforms such as drag:

1. the document remains stable during the gesture
2. the editor exposes transient preview state
3. the canvas applies that preview through the cheapest available placement
   layer
4. durable node transforms are committed once when the gesture ends

The default preferred implementation is:

- stable node shells and stable node art
- centralized placement updates for the active shells
- editor-owned overlays driven from editor geometry

not:

- rerendering node content during drag
- DOM-target-driven third-party transform overlays on the hot path
- broad store or React fanout for every drag tick

## Performance Hierarchy

When performance work is needed, prefer this order:

1. reduce the number of hot-path DOM writes
2. reduce the number of React updates needed for hot-path motion
3. simplify the visual representation for tiny or dense content
4. cull offscreen content

This order matters because the biggest regressions come from doing too much work
for visible, actively moving content.

## Consequences

- Multi-selection drag should stay cheap without depending on a separate
  selected-layer architecture unless measurement proves it is necessary.
- Zoom-sensitive interaction code must define whether a value is in canvas space
  or screen space before applying it.
- Heavy node types should eventually support simpler visual representation at
  small on-screen sizes.
- Viewport culling remains important, but it is not a substitute for a cheap
  hot interaction path.
