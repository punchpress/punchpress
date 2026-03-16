# 0002: Group Rotation Preview

Status: Accepted

Date: 2026-03-10

## Context

Multi-selection rotation uses Moveable group rotation handles, but the editor computes selection bounds from rendered node rectangles after state updates.

Those rendered rectangles are axis-aligned. If we force Moveable to recompute its group rect during an active rotate gesture, its internal drag state fights the fresh axis-aligned bounds and the selection box becomes erratic.

We still want two user-facing guarantees:

- multi-selection rotation should start from the corner controls, not from a separate rotation stem handle
- the selection box shown during group rotation should not jump on pointerup

## Decision

During multi-selection rotation, Moveable remains the interaction driver, but its own control box is treated as unstable UI.

The durable rule is:

- do not call `updateRect()` during `onRotateGroup`
- render a passive preview box that follows the live axis-aligned bounds of the selected nodes while the gesture is active
- hide the Moveable control box during the gesture and reveal it again after the gesture completes and the rect refreshes
- keep corner-based rotation as the supported interaction model for rotation

## Rationale

- This preserves stable pointer math by not rebasing Moveable mid-gesture.
- It removes the visible pointerup snap because the preview already matches the eventual post-gesture node bounds.
- It keeps the implementation small and local to the overlay layer without introducing a persistent group-transform model.
- It documents that this is an intentional interaction contract, not an incidental styling trick.

## Current Rules

1. Group rotation is initiated from the corner controls.
2. The dedicated rotation stem handle remains disabled.
3. A passive preview box is the source of truth for the live group-rotation outline.
4. Recomputing Moveable's rect is deferred until the rotate gesture ends.
5. Regressions should be guarded by E2E coverage for corner rotation and live preview bounds through pointerup.

## Source of Truth

The current implementation lives in:

- `apps/web/src/components/canvas/canvas-overlay.tsx`
- `apps/web/src/styles/canvas-vendor.css`
- `apps/web/tests/e2e/text-node-rotate.spec.ts`
