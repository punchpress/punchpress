---
summary: Captures the shared PunchPress transform model for single selection, multi-selection, group transforms, corner rotation, and live transform overlays.
read_when:
  - changing resize, rotate, drag, transform handles, or multi-selection transform behavior
  - evaluating whether a new interaction needs a separate transform surface
  - debugging transform jumps, unstable live bounds, or inconsistent selection chrome
---

# Transform Interaction Model

Status: Accepted
Date: 2026-03-10

## Context

Transforms are high-sensitivity editor interactions. Small changes can make
rotation or resize feel inconsistent, noisy, or unstable.

PunchPress needs one interaction model that works for single nodes,
multi-selection, groups, and path-edit transform states.

## Decision

PunchPress uses one editor-owned transform model.

- Rotation works for single selection and multi-selection.
- The old top stem or ball rotation handle stays disabled.
- Visible corner handles remain resize affordances.
- Rotation begins from the invisible perimeter outside corner handles.
- Rotated resize anchors to the opposite corner.
- Multi-selection transform follows the same model as single-node transform.
- The live transform box stays visible during pointer-driven transforms.

## Rejected Shortcuts

- Do not reintroduce a stem handle just to simplify implementation.
- Do not add heavy snapping or rounding that makes pointer-driven transforms
  feel worse.
- Do not animate live transform chrome during active gestures.
- Do not create separate transform surfaces for different selection types when
  one editor-owned overlay can represent them.

## Consequences

- Transform behavior is learnable across object types.
- Corner-perimeter rotation avoids extra visual noise.
- Live bounds remain stable through pointerup.
- Single-node, group, multi-selection, and path-edit transform chrome share one
  visual and behavioral family.
