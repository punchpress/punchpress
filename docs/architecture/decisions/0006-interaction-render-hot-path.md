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
- drag and similar gestures should prefer one shared visual transform over many
  per-node updates
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
3. the canvas applies that preview through the cheapest available visual layer
4. durable node transforms are committed once when the gesture ends

For large selected sets, the preferred visual layer is:

- one selected-layer transform

not:

- one per-node transform update if a shared transform can represent the same
  motion

## Performance Hierarchy

When performance work is needed, prefer this order:

1. reduce the number of hot-path DOM writes
2. reduce the number of React updates needed for hot-path motion
3. simplify the visual representation for tiny or dense content
4. cull offscreen content

This order matters because the biggest regressions come from doing too much work
for visible, actively moving content.

## Consequences

- Multi-selection drag should converge on a shared selected-layer transform.
- Zoom-sensitive interaction code must define whether a value is in canvas space
  or screen space before applying it.
- Heavy node types should eventually support simpler visual representation at
  small on-screen sizes.
- Viewport culling remains important, but it is not a substitute for a cheap
  hot interaction path.
