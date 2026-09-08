# Glossary

## Workspace and objects

**Workspace.** The nearly unbounded scene containing design objects and production
regions. This follows the parent repository's domain vocabulary.

**Viewport.** The portion of the workspace visible at a particular pan position
and zoom. Moving it changes where artwork appears on screen.

**Frame.** A finite production and export region. This build's toolbar and
layer name still say "artboard" while its properties heading says "Frame."
Verification steps quote the visible labels.

**Selection.** The objects selected for editing. Panning can change their visible
position without changing which objects are selected.

**Raster layer.** One logical object containing pixel artwork, imported or
painted. It can be stored as one image or multiple tiles. “Image” is the current
properties heading; raster bounds define its finite pixel rectangle.

**Empty layer.** A document placeholder without painted content. An eligible
content action can materialize it, preserving its role in the layer tree.

**Group.** A container that lets several objects be selected and transformed
together without converting them to one path or image.

**Group focus.** The selection scope in which group descendants become directly
reachable. It differs from merely expanding the group in Layers.

**Hidden.** Not normally rendered or eligible for an ordinary canvas hit. The
object can still exist in the document and layer tree.

**Locked.** Marked as locked in document state. Actual command eligibility must
be checked per feature; the label does not prove universal write protection.

**Hovered.** Currently under the pointer as an interaction candidate, without
necessarily being selected or edited.

## Vector geometry

**Anchor.** An editable point through which a vector contour runs.

**Segment.** A straight or curved connection between neighboring anchors.

**Contour.** One ordered sequence of anchors, either open or closed.

**Handle.** An anchor-relative control point shaping curve direction and
curvature. This differs from a whole-object resize handle.

**Corner point.** An anchor whose curve handles can move independently.

**Smooth point.** An anchor whose curve handles stay tangent-aligned.

**Logical corner.** One editable corner, including a rounded corner represented
by additional curve geometry.

**Live shape.** A polygon, ellipse, or star retaining parametric controls.

**Multi-contour path.** One path object containing disconnected or nested contours
with one shared style.

**Compound.** A vector container combining editable child paths through a live
operation. A compound wrapper created for that operation can be removed when
the compound is released.

**Destructive boolean.** An operation replacing its source objects with computed
geometry. Undo is distinct from retaining editable operands in a live compound.

**Path editing.** Editing anchors, handles, contours, or a supported text guide.
It is distinct from selecting the whole object or editing the wording of text.

## Tools and input

**Hand tool.** The toolbar tool used to pan the viewport. H selects it with
editor focus outside inputs, menus, and dialogs.

**Pointer tool.** The selection tool reached by V or Escape from idle Hand.

**Temporary pan.** Panning enabled by holding Space outside text inputs. The
selected toolbar tool remains the same.

**Gesture.** A press, optional movement, and release or interruption.

**Screen pixels.** Distances in the displayed browser view. These differ from
document units when zoom is not 100%.

**Zoom.** The displayed scale of artwork, shown as a percentage in the toolbar.

**Dab.** One circular brush application within a stroke.

**Stroke.** One Brush or Eraser gesture with a target chosen at its start.

**Raster target.** The selected or created Raster layer receiving the stroke.
Content under the pointer does not automatically replace a compatible selection.

**Hardness.** The brush setting controlling its solid center and soft edge.

**Spacing.** The interval between sampled brush applications.

**Tracking.** Additional spacing between text characters, in thousandths of an em.

**Warp.** A durable text layout shape, such as Arch, Wave, Slant, or Circle.

**Path position.** Where Circle text sits around its guide, distinct from moving
the whole text object.

**Font descriptor.** The family, full name, PostScript name, and style used to
identify a local font face.

**Local font catalog.** The font faces discovered from the current host.

**Missing font.** A referenced font whose required bytes are unavailable for
faithful layout or export.

## Documents and commands

**Scratchpad.** The permanent locally autosaved working document, distinct from
file tabs and their explicit save destinations.

**File tab.** An editor document with an optional retained save destination.
An untitled tab can have content before a file has been chosen.

**File handle.** A platform's identity/access object for a chosen file. Browser
handles and native file paths do not have identical deduplication behavior.

**Dirty.** Content differs from the editor's saved baseline. A file tab without
a destination can also require a save even when its editor baseline matches.

**Preset.** A named initial document/Frame size offered by New File.

**Recipe.** Editable document data embedded in exported SVG for round-trip import.

**Import.** Inserting external artwork or restoring an embedded editable recipe.

**Export.** Writing production SVG or PNG, distinct from saving an editable
`.punch` document.

**Asset.** External artwork found through the Assets search workflow.

**Recent document.** A retained file-backed identity offered for reopening.

**Scrub.** Changing a field value by dragging its control, usually within one
history mark. Plain typing does not necessarily use the same grouping.

**Mixed.** A properties display indicating different values among selected
objects; it is not a literal stored value.

**History mark.** A boundary grouping an edit so it can commit as one undo change
or explicitly restore its starting state.

**Preview.** A live interaction result that may not yet be durable document data.
The owning gesture determines how it commits or is discarded.

**HUD.** The optional on-screen performance display. Opening it does not itself
run a benchmark.

## Events that end or interrupt a gesture

**Release.** Releasing the pointer button after a press or drag.

**Cancel.** A request to abandon an interaction. Do not assume cancellation rolls
back viewport movement; the hand tool's mid-drag behavior is still an open check.

**Interrupt.** An event such as losing focus, changing tools, or changing input
devices during a gesture. Each feature must state whether it stops, continues,
or preserves work.

**Window loses focus.** Input focus moves to another window or app. The Space
modifier is cleared by the editor's window-blur handler.

## Evidence

**Drafted.** Written from source and tests, possibly with some browser checks.

**Verified.** All required P1/P2 checks received a human verification pass, with
failures recorded in triage. Agent-driven input alone does not qualify.
