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
  stops are `{ id, offset, color }`.
- Strokes add `width`, `align`, `join`, `cap`, and `miterLimit`.
- `text`, `shape`, standalone `path`, `vector`, and `group` nodes own
  `effects: Effect[]`. Groups own effects only, with no fills or strokes.
  - v1 ships one effect kind: `drop-shadow`, with color, opacity, offset, and
    blur.
  - A path inside a vector has no effects. A shared graph validator enforces
    this for documents, clipboard payloads, and every command that reparents
    a node or mutates effects. The vector owns the object shadow.
- Colors are canonical `#rrggbb` or `#rrggbbaa`. A headless parser in
  `punch-schema` canonicalizes input and rejects anything else. `"none"` and
  `"transparent"` mean an absent layer, not a color.
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

Paint leaves every geometry output, so a paint edit never rebuilds geometry.

Within one paint node, geometry merges into two paths:

- a fill path built from closed contours only
- a stroke path built from all contours

Text glyphs merge, so every stroke paints above every fill across glyphs.

#### Vectors

A vector plan is the ordered list of its child-path plans under the vector's
effect group.

- Plans are keyed by each child's appearance identity.
- Compound and boolean vectors restyle the compiled result from the
  style-source child (the last child) without recompiling geometry.

#### Compositing

These boundaries hold on the canvas, in dense surfaces, and in export:

- Each paint node is one opacity group, and its effects wrap that group.
- A group with opacity < 1 or any enabled effect is an **isolated layer**:
  - Its children composite first.
  - Group opacity then applies to the flattened result, so overlapping
    translucent children never double-darken.
  - Group effects apply to that composited result.
  - Child opacity still multiplies naturally. A 50% child inside a 50% group
    is 25% wherever it overlaps nothing.
- A group with opacity 1 and no effects is not isolated. Isolating it would
  render the same, so it gets no extra layer.

The canvas mechanism for isolation is in the next section.

#### Paint order

The fixed order is:

1. shadows
2. outside strokes
3. fills
4. center and inside strokes

Within each band, layers paint in list order.

Outside strokes go below fills because that is the only placement that keeps an outside ring
from eating into the fill, and a semi-transparent fill reveals at most a sliver
of overlap.

#### Stroke alignment

Inside and outside strokes compile to engine-generated offset-outline
geometry, cached per (geometry, width, join, miter).

- **Outside:** `offset(+w)` minus `offset(-min(w, 0.5))`. It paints under the
  fill, so the fill and the ring never share an antialiased edge.
- **Inside:** the geometry minus `offset(-w)`.
- **Open contours:** fall back to center, and the panel says so.

Clip and mask rejected (below).

#### Shadow filter

- Region: the paint ink plus a 4σ band around each offset shadow.
- `color-interpolation-filters="sRGB"`.
- Blur 0 skips `feGaussianBlur`.

#### Def ids

Canvas def ids are scoped per React mount (`useId`). Export ids are
deterministic and XML-escaped.

#### SVG export

Export writes one concrete `<path>` per layer, with no `<use>`. Fill and stroke
opacity go in their own attributes. The output uses only SVG 1.1 filter
primitives.

Production fidelity targets the app's Chromium, both for the PNG and for SVG
viewed in Chromium. Other SVG consumers are best effort.

### Isolated group layers on the canvas

Non-dense groups have no DOM element today. Their children render as flat
sibling shells (`canvas-nodes.tsx`). For an isolated group, the canvas adds
a **group layer**: an absolutely positioned, `pointer-events: none` wrapper
`div` at stage origin. The group's descendant shells render inside it, in
document order.

- **Compositing.** CSS `opacity` and `filter` on an HTML element isolate the
  subtree into one stacking context. This matches SVG group opacity
  semantics.
- **Shadow.** The plan's shadow parameters drive CSS `drop-shadow()` on the
  wrapper. `drop-shadow()` takes its blur as a standard deviation, so it
  receives `blur / 2`. Effects with more than one shadow chain one
  `drop-shadow()` per shadow. Export emits the equivalent SVG filter on
  `<g>`. Parity is tested.
- **Nesting.** Nested isolated groups nest wrappers. Non-isolated groups
  between them add no element.
- **Artboard clipping.** Inside an artboard, the wrapper also carries the
  artboard clip as an absolute `polygon()`, so a group shadow clips to the
  artboard like child art does.
- **Dense surfaces.** Isolation is a nested SVG `<g opacity filter>` inside
  the single surface `<svg>`, built from the same plan.
- **Selection and hit testing.** Unchanged. The wrapper never receives
  pointer events, and group shadows never hit. Drill-in and in-place child
  editing mount and update child shells inside the wrapper.
- **Drag.** When the selection covers a whole isolated group, the shared
  preview transform goes on the outermost wrapper, not on the child shells.
  The composited layer then moves without re-running its filter. Moving one
  child inside a shadowed group re-filters the group every frame, and the
  child-drag perf scenario bounds that cost.
- **Raster editing.** Brush work inside a shadowed group re-filters the group
  on every presented frame. The raster brush gates run once with the group
  present.

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
- **Hit testing:** follows alignment.
  - center: `|d| ≤ w/2`
  - outside: outside the shape and `d ≤ w`
  - inside: inside the shape and `d ≤ w`
  - fills: any enabled fill counts, at any opacity
  - no enabled paint: the node falls back to its paint box
  - shadows: never hit
- **Group resize:** scales shape and text stroke widths, all shadow offsets
  and blur, vector-container effects, and the group's own effects. Child-backed vectors resize through
  their descendants.

## Rejected Alternatives

- **Clip or mask over a doubled center stroke for alignment.** Antialiased
  edges composite to `1 - c(1 - c)` coverage and leave a background hairline.
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

## Consequences

- One plan builder replaces four paint renderers, and canvas/export parity is
  tested.
- Paint, color, and shadow edits never rebuild geometry or recompile vectors.
- Straight text with overlapping glyphs paints strokes above every fill.
- Many-filter zoom cost depends on Chromium raster-scale behavior. Stage 0
  measures it before the schema lands.
