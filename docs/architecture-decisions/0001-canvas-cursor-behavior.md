# 0001: Canvas Cursor Behavior

Status: Accepted

Date: 2026-03-07

## Context

The editor needs cursor feedback that reflects tool intent:

- empty canvas in text mode should show a crosshair because clicking places a new text layer
- existing text nodes in text mode should show an I-beam because clicking opens inline text editing
- hand mode and space-pan should show a grab cursor across both the canvas and nodes

We also want this behavior to be easy to extend without pushing tool-specific cursor logic down into every node component.

## Decision

Canvas cursor state is expressed on the canvas container with data attributes and resolved in CSS.

The durable rule is:

- tool and panning state belong at the canvas boundary, not on individual nodes
- cursor behavior should be derived by CSS selectors from container state
- node components should not accept tool-specific cursor props just to mirror canvas mode

## Rationale

- This keeps interaction state centralized at the canvas boundary.
- CSS can express shared and overridden cursor behavior more cleanly than per-node React props.
- Tool changes should not require pushing cursor class updates through the mapped node list.
- The approach matches the existing pattern already used for panning cursor behavior.

## Current Rules

1. In text mode, `.canvas-surface` uses `crosshair`.
2. In text mode, `.canvas-node` uses `text`.
3. When `data-panning="true"`, both `.canvas-surface` and `.canvas-node` use `grab`.
4. If future tools need cursor changes, prefer new container attributes and CSS selectors over new cursor props on `CanvasNode`.

## Source of Truth

The current implementation lives in:

- `apps/web/src/components/canvas.tsx`
- `apps/web/src/components/canvas-node.tsx`
- `apps/web/src/styles/global.css`
