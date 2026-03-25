# 0003: Transform Interaction Model

Status: Accepted

Date: 2026-03-10

## Context

Transform behavior is one of the highest-sensitivity interactions in the editor.

Small implementation changes can easily make rotation and resize feel inconsistent, noisy, or unstable. Because this code is likely to be revisited over time, we want the intended interaction model written down explicitly instead of relying on memory or scattered code comments.

## Decision

The editor uses one shared transform model for both single-node and multi-selection transforms.

The durable rules are:

- rotation is supported for both single selections and multi-selections
- the top stem / ball rotation handle stays disabled
- the visible corner handle remains the resize affordance
- rotation is initiated from an invisible perimeter just outside the corner handles
- rotated resize should feel anchored to the opposite corner
- multi-selection rotate and resize should follow the same interaction model as single-node transforms

## Visual Rules

- keep the editor-owned transform box as the base transform UI
- keep the default rotation cursor for now
- keep the same corner-handle look across single-node, multi-selection, group, and path-edit transforms
- keep the live transform box visible during pointer-driven transforms instead of swapping to a separate preview surface

## Rejected Shortcuts

- do not add heavy snapping or aggressive rounding tricks just to make the box look cleaner if they make transforms feel worse
- do not animate the live transform box during pointer-driven transforms
- do not re-enable the stem handle just to simplify tests
- do not introduce separate transform surfaces for different selection types if the same editor-owned overlay can cover them honestly

## Rationale

- A shared model across single and multi-selection transforms makes the editor easier to learn.
- Corner-perimeter rotation removes the extra visual noise of a dedicated stem handle.
- Opposite-corner anchored resize preserves spatial intuition for rotated content.
- One editor-owned overlay model keeps interaction behavior and styling aligned across node and group transforms.
- A live overlay that is driven directly from editor geometry removes third-party rect synchronization issues.

## Testing Guidance

- Preserve at least one E2E test that rotates from the corner perimeter rather than a stem handle.
- Preserve at least one E2E test that covers multi-selection rotation through pointerup without a visible jump in live bounds.
- Prefer behavioral assertions over styling-only assertions where possible.

## Source of Truth

The current implementation lives in:

- `apps/web/src/components/canvas/canvas-overlay.tsx`
- `apps/web/src/components/canvas/canvas-overlay/canvas-single-node-transform-overlay.tsx`
- `apps/web/src/components/canvas/canvas-overlay/canvas-multi-node-transform-overlay.tsx`
- `apps/web/src/styles/canvas-vendor.css`
- `apps/web/tests/e2e/text-node-rotate.spec.ts`
