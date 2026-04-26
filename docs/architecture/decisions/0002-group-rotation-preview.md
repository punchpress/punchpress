# 0002: Group Rotation Overlay

Status: Superseded

Date: 2026-03-10

## Context

The original group rotation implementation relied on a separate preview surface to hide pointerup jumps in a third-party transform overlay.

That is no longer the active architecture. The editor now uses one custom transform overlay model for single-node, multi-selection, and group transforms.

## Decision

This decision is superseded by the editor-owned transform overlay model described in:

- `0003-transform-interaction-model.md`

The durable user-facing guarantees still matter:

- multi-selection rotation starts from the corner controls
- the live selection box should remain stable through pointerup

Those guarantees are now implemented by the main custom overlay rather than a dedicated rotation preview surface.

## Source of Truth

The current implementation lives in:

- `apps/web/src/components/canvas/canvas-overlay/selection/multi-selection-foreground.tsx`
- `apps/web/tests/e2e/text-node-rotate.spec.ts`
