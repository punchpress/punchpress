---
summary: Tracks the Affinity-style Pointer and Node selection parity audit, current decisions, fixes, verification, and remaining follow-up.
read_when:
  - continuing Pointer, Node, marquee, group drill-in, or path point selection parity work
  - checking which Affinity-style selection behaviors are implemented, deferred, or intentionally out of scope
  - preparing Playwright inspector commands for selection interaction review
---

# Affinity Selection Audit

This log tracks the Pointer and Node selection parity pass.

## Done

- Pointer double-click gives editable path/vector targets precedence over group
  drill-in. Grouped text still drills into the group first.
- Node tool object marquee works before active path editing.
- Node tool marquee previews intersecting editable curve candidates during
  drag, then selects them on release. This includes curves nested under groups
  and vector containers.
- Object marquee uses full enclosure by default.
- Partially intersected objects are not selected by marquee.
- Marquee-selected multi-selection drag works from selected node element bounds.
- Overlapping normal clicks select the topmost eligible object.
- Current docs state that Auto-select modes, select-under cycling, freehand
  lasso point selection, and selected-anchor scale/rotate transform boxes are
  not exposed.

## Verified

- `bunx playwright test apps/web/tests/e2e/group-drill-in.spec.ts --workers=1`
- `bunx playwright test apps/web/tests/e2e/marquee-selection.spec.ts -g "moves multiple layers together|ordinary top-level|ignores partially" --workers=1`
- `bunx playwright test apps/web/tests/e2e/marquee-selection.spec.ts -g "ordinary top-level|ignores partially|compound vector curves|nested curves" --workers=1`
- `bunx playwright test apps/web/tests/e2e/selection-targeting.spec.ts --workers=1`
- `bunx playwright test apps/web/tests/e2e/vector-path-edit.spec.ts -g "dragging a marquee in path edit mode selects multiple path anchors" --workers=1`

## Deferred Product Choices

- Auto-select modes.
- Select-under cycling.
- Freehand lasso point selection.
- Selected-anchor scale/rotate transform boxes.

## Final Verification

- `bun test apps/web/tests/editor-contract/path-point-move-selection.test.ts`
- `bun run docs:list`
- `bun run lint`
- `bunx playwright test apps/web/tests/e2e/group-drill-in.spec.ts apps/web/tests/e2e/selection-targeting.spec.ts apps/web/tests/e2e/marquee-selection.spec.ts -g "drills into the group|targets deeply nested|topmost visible|moves multiple layers together|ordinary top-level|ignores partially|compound vector curves|nested curves" --workers=1`
- `bunx playwright test apps/web/tests/e2e/vector-path-edit.spec.ts -g "dragging a marquee in path edit mode selects multiple path anchors" --workers=1`

## Inspector Commands

```bash
PWDEBUG=1 bunx playwright test apps/web/tests/e2e/group-drill-in.spec.ts -g "drills into the group|targets deeply nested" --headed --workers=1
PWDEBUG=1 bunx playwright test apps/web/tests/e2e/marquee-selection.spec.ts -g "moves multiple layers together|ordinary top-level|ignores partially|compound vector curves|nested curves" --headed --workers=1
PWDEBUG=1 bunx playwright test apps/web/tests/e2e/selection-targeting.spec.ts --headed --workers=1
PWDEBUG=1 bunx playwright test apps/web/tests/e2e/vector-path-edit.spec.ts -g "dragging a marquee in path edit mode selects multiple path anchors" --headed --workers=1
```
