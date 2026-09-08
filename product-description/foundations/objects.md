# Objects and document state

The workspace contains editable design objects. A Frame defines a finite
production region; the surrounding workspace remains available for arrangement.
Object position, geometry, appearance, and order are document content. The view
through which the user sees them is separate.

## Object families

| User concept | What remains editable |
| --- | --- |
| Text | Characters, font, appearance, and text warps |
| Shape | Parametric polygon, ellipse, or star geometry |
| Raster layer | Image pixels and raster bounds |
| Path | Vector points, handles, contours, fill and stroke |
| Vector | A container of editable paths and composition |
| Group | Several objects arranged and transformed together |
| Frame | Production region, size, background, and contained artwork |
| Empty layer | A placeholder in the document tree |

> Technical note: Saved node names include `image` and `artboard` for Raster layer
> and Frame. Existing UI still uses “artboard” in places. Those identifiers do not
> mean the raster workspace is infinite or that all artwork is flattened.

## Containers and selection

Objects can belong to a container. Selecting a group normally selects the useful
outer object. Entering group focus makes descendants individually reachable.
A vector's editable path can own point editing while its containing vector
remains the visible composition.

Only the topmost eligible visible artwork wins an ordinary canvas hit. A hidden
object does not become a click target merely because its stored bounds overlap
the pointer. Layers provide a separate way to reach document objects.

Selection, hover, focused group, inline text editing, and point selection are
different states. Changing selection can finish a text edit. Starting text
editing clears incompatible path editing; starting path editing clears its
incompatible transient interaction state.

## Document and session state

The document contains the design and its asset references. Undo tracks changes
to objects and their order. Viewport pan/zoom, hover, temporary pan modifiers,
and open menus are not document undo steps.

Loading content and restoring a browser workspace are separate operations. A
saved `.punch` file and the local scratchpad have different persistence paths;
see the document descriptions before assuming one replaces the other.

## Open questions and verification

- Mixed terminology is observable: the toolbar says “Add artboard” and the
  properties panel says “Frame.” This set follows `CONTEXT.md` while quoting UI.
- Locked and hidden objects need verification through each editing command;
  a canvas targeting rule must not be generalized to every command.
- Evidence: schema node union, node-tree and selection actions, interaction-state
  transitions, and interaction-modes/group-selection tests.

Source reviewed against PunchPress commit `d4e6d4a`. Status: drafted.
