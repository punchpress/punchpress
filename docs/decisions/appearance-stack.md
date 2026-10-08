---
summary: Records the per-node appearance stack decision (ordered fills, strokes, and drop-shadow effects), its schema and migration contract, the engine-owned render plan shared by canvas and export, compositing and bounds rules, and rejected alternatives.
read_when:
  - changing fill, stroke, gradient, shadow, or node opacity data, rendering, export, or panel controls
  - adding a paint kind, stroke alignment, blend mode, or effect such as inner shadow or offset outline
  - debugging a mismatch between canvas appearance, text-edit preview, SVG export, and PNG export
  - deciding whether shadow or stroke extents belong in ink, selection, or hit bounds
---

# Appearance Stack

Status: Accepted
Date: 2026-10-07

The rollout, budgets, and test matrix live in the
[Appearance stack plan](../internals/appearance-stack-plan.md). That page is
retired when the work lands.

## Context

### Paint is flat and split by node family

Paint today is a set of flat scalar fields that differ by node family
(`packages/punch-schema/src/schema.ts`):

| Family | Fields |
| --- | --- |
| `text`, `shape` | `fill`, `stroke`, `strokeWidth` |
| `path` | the same three, plus `fillRule`, cap, join, and miter |
| `vector` | none of its own; it aggregates its child paths |

There are no gradients and no effects. Node `opacity` exists on every node, but
no command or panel control edits it.

### Four renderers derive paint separately

The canvas art (`node-render-tree.tsx`), the inline-edit preview
(`canvas-text-editor.tsx`), and SVG export (`node-svg-export.ts`) each read
paint on their own. PNG export rasterizes the SVG export
(`use-document-commands.ts`).

### Paint leaks into geometry

Paint fields feed geometry signatures (`shape-capabilities.ts`,
`path-capabilities.ts`, and `strokeWidth` for text), vector render entries
(`vector-render-geometry.ts`), and stroke-inflated bounds.

### The canvas is SVG DOM

- Each node gets a shell whose transform pivots at the frame center
  (`use-canvas-node-placement.ts`). The shell holds an `overflow-visible`
  `<svg>`.
- Pan and zoom are a viewer CSS transform.
- Only images use Canvas2D.

## Decision

### Data model

- `text`, `shape`, and `path` nodes own `appearance: { fills, strokes }`.
- Every layer has:
  - an `id` (unique within its node)
  - `enabled`
  - `opacity`
  - `paint`, which is either `solid` or `linear-gradient`
- Gradient start and end points are normalized to the paint box. Gradient
  stops are `{ id, offset, color, opacity }`: 2–8, sorted by offset (equal
  offsets make hard edges), ids unique within the gradient and ignored by
  stack equality.
- Strokes add `width`, `align`, `join`, `cap`, and `miterLimit`.
- `text`, `shape`, standalone `path`, `vector`, and `group` nodes own
  `effects: Effect[]`. Groups own effects only, with no fills or strokes.
  - v1 ships one effect kind: `drop-shadow`, with color, opacity, offset, and
    blur.
  - A path inside a vector has no effects. A shared graph validator enforces
    this for documents, clipboard payloads, and every command that reparents
    a node or mutates effects. The vector owns the object shadow.
- Colors are opaque canonical `#rrggbb`. Transparency is always a layer,
  stop, or shadow `opacity`, never color alpha, so one value owns it. A
  headless parser in `punch-schema` canonicalizes input and rejects anything
  else. `"none"` and `"transparent"` mean an absent layer, not a color.
- Shadow `blur` uses CSS `box-shadow` blur-radius semantics:
  `stdDeviation = blur / 2`. Offsets and blur are node-local, so shadows rotate
  and scale with the object. New shadows default to blur 0, a hard offset
  shadow.
- New text gets one black solid fill and no stroke.

### Versioning

- The only data-reshaping migration is 1.8 → 1.9. It folds the flat fields
  into layers and maps `"none"` to absent.
- The normalizer stops synthesizing the retired path stroke fields.
- Clipboard payloads with `documentVersion: "1.8"` take the same upgrade.
- 1.7 and older stay unsupported.
- Each stage that widens the schema bumps the version freely, with a
  minimal passthrough upgrade step. Versioning resets before the real release,
  so migrations stay small.

### Commands

| Command | Notes |
| --- | --- |
| `addFill`, `addStroke`, `addEffect(kind)` | |
| `updateAppearanceLayer(slot, patch)` | |
| `removeAppearanceLayer(slot)` | |
| `moveAppearanceLayer(slot, toIndex)` | |
| `setAppearance` | Replaces the whole stack. |

- Each command takes an optional `nodeIds` and defaults to the selection.
- `slot` is `{ list, index }`. A multi-selection with structurally equal
  stacks shares indexes. The UI keys controls by layer `id` and resolves to
  the current index at dispatch. A control whose id disappears closes.
- A vector routes fills and strokes to its child paths and keeps effects on
  itself.
- The per-field paint descriptors are deleted.

### One engine-owned render plan

`packages/engine/src/appearance/` builds an `AppearanceRenderPlan` from durable
state. The canvas, the text-edit preview, dense group surfaces, and SVG export
all render that plan. PNG export rasterizes the plan-built SVG.

#### Geometry

Geometry, hit regions, signatures, and compiled vector surfaces depend only
on a paint *extent*: whether any fill is enabled and the widest enabled stroke.
Color, opacity, cap, join, and order edits therefore never rebuild geometry;
a width change rebuilds only the extent-dependent bounds and hits.

The plan paints a node's geometry paths in **passes**. A fill directly
followed by a stroke shares one element (`paint-order: fill stroke`) only when
the object has a single geometry path; with several paths (unmerged glyphs,
multi-contour entries) each draw is its own pass across all paths, so every
stroke paints above every fill. Fills paint open contours with SVG's implicit
closure, on canvas and in export alike.

#### Vectors

A vector plan is the ordered list of its child-path plans under the vector's
effect group.

- Plans are keyed by each child's appearance identity.
- Compound and boolean vectors restyle the compiled result from the
  style-source child (the last child) without recompiling geometry.

#### Compositing

These boundaries hold on the canvas, in dense surfaces, and in export:

- Each paint node is one opacity group, and its effects wrap that group.
  Opacity applies to the content and its shadow together.
- A group with opacity < 1 or any enabled effect is an **isolated layer**:
  - Its children composite first.
  - Group opacity then applies to the flattened result, so overlapping
    translucent children never double-darken.
  - Group effects apply to that composited result.
  - Child opacity still multiplies naturally. A 50% child inside a 50% group
    is 25% wherever it overlaps nothing.
- A group with opacity 1 and no effects is not isolated. Isolating it would
  render the same, so it gets no extra layer.

The render tree below defines the canvas mechanism for isolation.

#### Paint order

The fixed order is:

1. shadows
2. outside strokes
3. fills
4. center and inside strokes

Within each band, layers paint in list order.

Outside strokes still go below fills even though each is masked to its own
shape's outside: an object with several paths (text glyphs) masks each path
separately, so one glyph's ring can overlap a neighboring glyph, and painting
rings first keeps every fill on top. Under a translucent neighbor the ring
shows through, as it would in any stacked artwork.

#### Stroke alignment

Aligned strokes are SVG-native, as in Figma; there is no offset geometry in
the render path. Canvas and export render the same engine element tree
(`buildAppearanceElements`), so they cannot drift.

- **Inside:** a `2w` center stroke clipped (`clipPath`, `clip-rule` = the
  path's fill rule) to the path's own fill region.
- **Outside:** a `2w` center stroke under a luminance `mask`: white over the
  reach box, black over the path's fill region (honoring its fill rule). The
  reach box is the path's local bounds grown by `w × miterLimit` (miter),
  `w·√2` (square caps), or `w`, plus slack for flattened bounds. A
  translucent fill never shows the stroke's inner half.
- **Per path.** The clip or mask sits on the element that carries the path
  transform, so its geometry is path-local. Each glyph or vector child aligns
  against its own shape; warped text, which is one merged outline, aligns
  against the merged shape.
- **Open contours.** Inside and outside are relative to the region the fill
  paints, so open contours in a path that also has a closed contour close
  implicitly, as SVG fills them. An object whose paths have no closed contour
  at all strokes on center, and the panel says so.
- **Accepted artifact.** Only the antialiased edge. With edge coverage `c`, an
  outside ring meets its fill at `c + (1 − c)²` coverage, a faint background
  seam of at most 25% at half-covered pixels. An inside ring over its fill
  reaches `2c − c²`, a slightly firmer edge with a fill-colored fringe.
- **Gradients** on aligned strokes keep the unstroked paint box; only the
  stroke width doubles.

#### Shadow filter

- Region: the paint ink plus a 4σ band around each offset shadow.
- `color-interpolation-filters="sRGB"`.
- Blur 0 skips `feGaussianBlur`.

#### Gradients (stage 4)

- **Paint box.** Every geometry output carries `paintBox`, its unstroked
  bounds: text layout bounds, a shape's flattened contour bounds (the same
  algorithm paths use, so converting a shape keeps its gradient), a path's raw
  bounds. Vector entries carry their child's box in the child's local space;
  compiled compound and boolean results carry the result's bounds.
- **Paint space.** Leaf art paints in node space: glyph layout transforms are
  undone per glyph with a `gradientTransform` built from numeric layout
  matrices, so one ramp spans the whole text. Vector children paint in their
  own local space, where the entry transform only places them.
- **Mapping.** `userSpaceOnUse` coordinates are `minX + u × width`, likewise
  for y; a collapsed axis maps to its minimum. A zero-length vector paints the
  last stop's color and opacity.
- **Angle.** The angle is measured in node-local units through the paint box,
  so a 45° gradient on a 200 × 100 box looks 45°.
- **Conversion.** Solid → linear fades the color from opacity 1 to 0, left to
  right. Linear → solid keeps the first stop and folds its opacity into the
  layer. Add fill copies the top fill's paint.
- **Live color preview.** The engine derives a preview copy of each targeted
  node with only the previewed fields rewritten (`editor.getPaintNode`), and
  only those nodes re-render. It targets exact fields, layers, and stops, and
  carries alpha. The earlier CSS-variable preview is removed.
- **Fallback text** (font not loaded) paints a gradient's first stop.

#### Def ids

Canvas def ids are scoped per React mount (`useId`). Export ids are
deterministic and XML-escaped.

#### SVG export

Export writes one concrete `<path>` per layer, with no `<use>`. Fill and stroke
opacity go in their own attributes. The output uses only SVG 1.1 filter
primitives.

Production fidelity targets the app's Chromium, both for the PNG and for SVG
viewed in Chromium. Other SVG consumers are best effort.

### Group contiguity invariant

A group's descendants are contiguous in document paint order. The engine
enforces this as a document-model invariant:

- normalize on load
- insert
- reparent
- reorder
- paste

Each operation canonicalizes subtree order instead of rejecting the input:
canonical order is preorder with siblings in their existing relative order.
The engine store applies it to every write that carries `nodes`, and
`punch-schema` applies it on parse and clipboard paste. Parent cycles are
invalid at document and clipboard ingress. Renderers and export rely on the
invariant and never work around interleaving.

Older documents whose array interleaved a group's children with other nodes
change visible stacking on load: each child moves up to its group's subtree,
which is the stacking the layers panel already showed.

### Engine-owned render tree

Today the canvas renders a flat list of node ids (`canvas-nodes.tsx`), and
export discards groups. Both move to one engine-owned ordered **render tree**
derived from the document. The vector render-surface pipeline already plans
this direction (engine-owned render derivation). The tree has three kinds of
layer:

| Layer | Owns | Moves during drag |
| --- | --- | --- |
| Clip | artboard clip, stationary in stage space | only when its artboard moves |
| Presentation | placement and the shared preview transform | yes |
| Effect | isolation, opacity, and the effect filter graph | with its presentation parent |

**Isolation.** An isolated group is an effect layer wrapping its descendants'
presentation. The order is: clip → presentation → effect → children.
Descendant artboard clips inside that boundary are dropped, so shadow input
is never pre-clipped.

**Composite order.** Opacity applies to content plus shadow together: the
filter runs first, then opacity. This is native CSS and SVG order, and it
matches Figma.

**Multiple shadows.** Each shadow branches from the same `SourceAlpha` and
merges through one filter graph (canvas `filter: url(#…)` from that graph, or
the SVG filter in export). Chained `drop-shadow()` is not used, because it
shadows earlier shadows.

**Preview ownership.** The placement layer resolves a disjoint set of fully
covered presentation roots for each gesture:

- descendants of a root receive no writes
- partial selections keep leaf transforms
- cancel and commit restore the same roots

**Representation.** The dense-surface choice is part of the tree. A dense
group stays one surface unless it is the focused group, or the text or path
being edited sits inside it; then every group on that path expands. Focus
alone keeps dense ancestors collapsed, since deep hit testing reaches into
surfaces. Previews never write the store, so the tree stays referentially
stable through gestures.

**Editing artwork.** The text-edit preview renders in its node's tree slot,
so group opacity and effects apply. Caret and input chrome stay outside the
effect layers.

**Raster.** Raster pixel-grid chrome sits outside effect layers. Exact raster
presentation expands by effect support, so offscreen pixels still cast an
onscreen shadow. Resident Canvas ownership survives representation changes.

**Hit testing.** Leaf hit buttons and engine geometry checks are unchanged.
Effect and clip layers never register as hit targets. Dense presentation
bounds stay separate from geometric hit bounds.

**Group coordinates.** Groups have no persistent transform. Group effect
offsets are stored in group space. When group rotate, scale, or flip bakes
into the children, the same commit rotates and scales the group's effect
offsets and blur. Preview and commit therefore agree.

**Export.** Export serializes the same tree hierarchically. Each opacity or
effect has exactly one owner, and nothing is multiplied into leaves at
isolation boundaries.

**Performance.** A stacking context is not a guaranteed cached bitmap. Only
active presentation roots are promoted. Layer count, filter work, memory, and
settle frames are measured in the shipped Chromium.

### Bounds and hit testing

- **Selection frame:** today's semantics. It is the geometry plus half the
  center stroke width, the full outside width, and 0 for inside. Miters do
  not count.
- **Ink bounds:** the conservative extent. Miter protrusion (`miterLimit ×
  w/2`) and square caps (`w·√2/2`) count, and so do shadows. Layers that are
  disabled or have zero alpha do not count.
- **Uses of ink bounds:** filter regions, dense-surface frames, and export
  extents. Shells do not grow. Shadows paint through the `overflow-visible`
  `<svg>`, so the transform pivot and the shell hit button stay on the frame.
- **Hit testing:** follows alignment. Each hit region carries an inside and
  an outside reach (center contributes `w/2` to each, aligned strokes `w` to
  their side); a point inside the fill region tests the inside reach and a
  point outside tests the outside reach, as a distance band. Joins and caps
  are approximated by that band. A 3-unit interaction tolerance applies on
  both sides so thin and aligned strokes stay grabbable. The fill region
  closes open contours, as SVG fills them.
  - fills: any enabled fill counts, at any opacity
  - no enabled paint: the node falls back to its paint box
  - shadows: never hit
- **Group resize:** scales shape and text stroke widths, all shadow offsets
  and blur, vector-container effects, and the group's own effects. Child-backed vectors resize through
  their descendants.

### Render tree as built (stage 3)

Stage 3 builds the opacity part of this model. Shadows need the rest, so it
lands with stage 6:

- `editor.getRenderTree()` returns layers (every group and artboard, always
  present so opacity changes never re-parent descendants), shells, and dense
  surfaces, plus the flat list of placed shell and surface ids.
- A layer is a zero-size `div` with no node markers. CSS `opacity` below 1
  isolates its subtree. Layers never move: previews keep moving leaf shells, so
  preview roots stay disjoint without a placement rewrite.
- Leaf art and dense-surface roots carry only their own opacity. Ancestor
  opacity lives on the layers, and export nests one `<g opacity>` per
  translucent group or artboard.
- Artboard opacity fades the artboard's content, not its background.
- The text-edit preview paints in its node's shell, sized from the live
  preview frame, so group compositing applies while editing. The input and
  caret stay outside.
- Deferred to stage 6, where shadows make them necessary and measurable:
  stationary artboard clip layers (per-shell clips stay; their rotation-preview
  inaccuracy predates this work), moving presentation layers during whole-group
  drags, and expanding exact-raster presentation by effect support. Raster
  pixel-grid chrome already renders outside node art.

## Rejected Alternatives

- **Compiled offset outlines for alignment.** Exact rings with no edge seam,
  but measured far too slow for live width scrubs and typing (offset only,
  system fonts at 100 px, a 36–41 glyph line): paperjs-offset 2.2.1 took
  120–420 ms outward and up to 1.7 s inward per line, and its 0.5-unit tuck
  70–217 ms per glyph (2.7–8 s for an outside stroke); clipper2-ts 2.0.1 took
  55–275 ms per line and 2–17 s for ~430 glyphs, or 0.4–4 ms per unique
  glyph (10–115 ms per novel width) with per-glyph caching, which warped text
  cannot reuse. Product chose the SVG-native seam instead.
- **World-space ("global light") shadows.** Under non-uniform scale they need
  a skewed Gaussian, and a rotation preview would rebuild the filter every
  frame.
- **One interleaved fill and stroke list.** Paint order is fixed by kind and
  alignment instead.
- **Effects on vector child paths.** Overlapping children would shadow their
  siblings.
- **Flattened group opacity** (multiplying group opacity into each leaf).
  Overlapping translucent children double-darken, and group shadows become
  impossible.
- **Always isolating groups.** It adds a compositing layer per group with no
  visual change when opacity is 1 and there are no effects.
- **Growing shells to ink bounds.** The shell transform pivots at the frame
  center, so shadow edits would move rotated art.
- **`<use>` in export.** It is SVG2 `href` and breaks SVG 1.1 tooling.

## Non-goals

- **Offset Path / Outline Stroke command.** An explicit command that bakes
  offset or outlined geometry (die-cut and sticker contours) is future work.
  It would use the measurements above to pick a library (clipper2-ts per
  glyph is the fastest candidate; paperjs-offset keeps curves) and runs once
  on demand, so the per-frame cost that ruled out rendering with it does not
  apply.

## Consequences

- One plan builder replaces four paint renderers, and canvas/export parity is
  tested.
- Paint, color, and shadow edits never rebuild geometry or recompile vectors.
- Straight text with overlapping glyphs paints center and inside strokes above
  every fill, and outside rings below every fill.
- Aligned strokes show an antialiased seam at the shape edge (see Stroke
  alignment).
- Many-filter zoom cost depends on Chromium raster-scale behavior. Stage 0
  measures it before the schema lands.
