# The viewport

The viewport shows a region of the workspace at a chosen zoom. Panning changes
the viewed position. Zoom changes the displayed size of artwork. Neither edits
the artwork or adds an undo step.

## Scale and movement

Zoom ranges from 1% to 200%. At 100%, one document unit maps to one CSS screen
pixel; device-pixel density is a separate browser concern. A fit operation can
choose a much lower percentage for a large production Frame.

Ordinary wheel input pans. Ctrl/Cmd plus wheel zooms around the pointer. Each
wheel zoom event changes the current scale by at most 10% of that scale before
the global limits apply. Oversized wheel deltas therefore do not produce an
unbounded zoom step.

The workspace point beneath the pointer stays anchored while zoom changes.
Wheel pan over selected transform chrome compensates for zoom so the displayed
movement remains consistent with ordinary canvas wheel movement.

## Placement and fitting

The first substantial inserted object can be fit into view. Later additions
do not automatically refit an established workspace. Intrinsic-size imports
are distinct from click-created shapes with ergonomic starter dimensions.

Hand drag and Space pan are described in [the hand tool](../tools/hand-tool.md).
Do not substitute the object-drag threshold for the viewport library's behavior.

## Interruptions and persistence

Zoom is a sequence of view updates, not an open document edit waiting for a final
commit. Undo affects artwork, not the preceding pan or zoom. Tab restoration and
scratchpad persistence may restore views separately from history.

Browser focus loss clears temporary Space mode. It does not prove the viewport
library cancels an already-active drag. Touch pinch and inertia need device
verification rather than extrapolation from wheel calculations.

## Open questions and verification

- Confirm wheel and pinch behavior with real mouse, trackpad, and touch hardware.
- The original docs say “device pixel” at 100%; the inspected browser coordinate
  math uses CSS/client pixels. Keep this distinction during any eventual merge.
- Evidence: zoom constants, viewport wheel/focus modules, canvas wheel handler,
  viewport-wheel-zoom and viewport-focus tests. These pass in the source baseline.

Source reviewed against PunchPress commit `d4e6d4a`. Status: drafted.
