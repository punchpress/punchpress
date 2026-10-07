---
summary: Proposes the per-node appearance stack (ordered fills, strokes, and drop-shadow effects) with its schema, 1.8 migration, Editor commands, engine render plan, canvas/export parity, bounds, performance budget, tests, and staged rollout.
read_when:
  - changing fill, stroke, gradient, shadow, or node opacity data, rendering, export, or panel controls
  - adding a paint kind, stroke alignment, blend mode, or effect such as inner shadow or offset outline
  - debugging a mismatch between canvas appearance, text-edit preview, SVG export, and PNG export
  - deciding whether shadow or stroke extents belong in ink, selection, or hit bounds
---

# Appearance Stack

Status: Proposed
Date: 2026-10-07

## Context

Paint is flat scalar fields that differ by node family
(`packages/punch-schema/src/schema.ts`):

| Node | Paint fields today |
| --- | --- |
| `text`, `shape` | `fill` (required), `stroke` (nullable), `strokeWidth` |
| `path` | `fill`/`stroke` (nullable), `strokeWidth`, `fillRule`, `strokeLineCap`, `strokeLineJoin`, `strokeMiterLimit` |
| `vector` | none; child paths paint, aggregated by `inspection/selection-properties.ts` |
| `artboard` | `background` |
| `group`, `image`, `empty` | base `opacity` only |

Colors are CSS strings; the picker writes `#rrggbb` or `rgba(...)`
(`components/ui/color-picker/color-picker-value.ts`). Node `opacity` exists on
every node but has no command or panel control.

Four renderers each derive paint independently:

| Renderer | Where | Notes |
| --- | --- | --- |
| Canvas art | `canvas-node/node-art-state.ts` → `node-render-tree.tsx` `CanvasNodePath` | one `<path>` per geometry path (one per glyph for straight text), `paint-order="fill stroke"`, node opacity on the node `<g>`, ancestor group opacity multiplied per path |
| Text inline-edit preview | `canvas-text-editor.tsx` | its own glyph paths from `editingNode.fill/stroke/strokeWidth`; the original node stays mounted at opacity 0 |
| SVG export | `packages/engine/src/nodes/node-svg-export.ts` | string concatenation, duplicated fill/stroke fallback, node × inherited opacity per `<path>`, already emits SVG2 `paint-order` |
| PNG export | `use-document-commands.ts` `renderSvgToPngBlob` | rasterizes the artboard SVG export through `Image` + Canvas2D at 1x |

Paint also leaks into geometry. Shape and path geometry signatures include
paint (`shape-capabilities.ts`, `path-capabilities.ts`), and text includes
`strokeWidth`. Vector render entries bake `fill`/`stroke`/`strokeWidth`
(`vector-render-geometry.ts`), and stroke inflation is applied inside the
geometry builders (`warp-engine.ts` `getStrokeInflatedBounds`,
`shape-engine.ts`, `vector-render-geometry.ts` `expandBounds`). That one
inflated bbox then feeds both `getNodeRenderFrame` and `getNodeSelectionFrame`
(`queries/node-queries.ts`).

The canvas is SVG DOM:

- Each node has an absolutely positioned shell with an `overflow-visible`
  inline `<svg>`.
- During drags the shell moves by `translate3d`
  (`use-canvas-node-placement.ts`).
- Pan and zoom are a `react-infinite-viewer` CSS transform.
- There is no culling and no vector LOD.
- Only image nodes use Canvas2D
  ([Resident Canvas2D Raster surface](raster-resident-canvas-surface.md)).
- No node art or export uses `<defs>`, gradients, filters, or masks.

The tile-store page `docs/internals/raster-engine.md` and the
`raster-visual-sweep.spec.ts` zoom-ladder spec exist only on the unmerged
`claude/clever-raman-921f5a` branch, not on `main`.

## Decision

### 1. Schema (v1)

```ts
type Color = string; // existing CSS color contract

type Paint =
  | { kind: "solid"; color: Color }
  | {
      kind: "linear-gradient";
      start: { x: number; y: number }; // normalized to the paint box (§4)
      end: { x: number; y: number };
      stops: { offset: number; color: Color }[]; // 2..8, offset 0..1, sorted
    };

type FillLayer = { enabled: boolean; opacity: number; paint: Paint };

type StrokeLayer = FillLayer & {
  width: number; // node-local units, center-aligned
  join: "miter" | "round" | "bevel";
  cap: "butt" | "round" | "square";
  miterLimit: number;
};

type Effect = {
  kind: "drop-shadow";
  enabled: boolean;
  color: Color;
  opacity: number;
  offsetX: number; // node-local units; rotates and scales with the node
  offsetY: number;
  blur: number; // CSS blur radius; stdDeviation = blur / 2
};

// text | shape | path:  appearance: { fills: FillLayer[]; strokes: StrokeLayer[] }  (max 8 each)
// text | shape | path | vector:  effects: Effect[]  (max 4)
```

- Paint order is fixed: effects → fills (bottom→top) → strokes (bottom→top).
- `fillRule` stays on `path` as geometry semantics.
- Node `opacity` stays on the base node.
- Layers have no ids. Commands address a layer by `{ list, index }`.
- A path inside a vector must have `effects: []`. The existing `superRefine`
  that validates vector children enforces this. Commands that move a path into
  a vector (compound, join) clear its effects. The vector container owns the
  object shadow, so overlapping child paths do not shadow each other.

**Room for later work.** Radial gradient and inner shadow add `kind` members,
and documents saved earlier still validate. Blend modes and stroke alignment
arrive as optional fields whose absent value is defined in the schema
(`normal`, `center`), so neither needs a data migration. A double outline is
already two center strokes. A gap outline adds an optional stroke field.

### 2. Migration (1.8 → 1.9)

`migrateDocument` (`packages/punch-schema/src/migrate.ts`) accepts only the
current version today. The last upgrade branch was removed in 17e31ece, and
[Schema versioning](../reference/schema-migration.md) forbids old-version
upgrades without an explicit product decision. This design is that decision for
one step.

The new `1.8` branch runs `upgradeAppearance1_8(node)` before
`normalizeNodesForSchema`, then `PUNCH_DOCUMENT_VERSION` becomes `1.9`.

| 1.8 source | 1.9 result |
| --- | --- |
| `fill` non-null | one enabled solid fill, opacity 1 |
| `fill` null (path) | `fills: []` |
| `stroke` non-null and `strokeWidth > 0` | one solid stroke with that width |
| `stroke` null or width ≤ 0 | `strokes: []` |
| path cap/join/miter | copied into the stroke |
| text/shape cap/join | what the canvas paints today (round/round, miter 4) |
| text/shape/path/vector | `effects: []` |

Clipboard payloads pin `documentVersion` (`punch-schema/src/clipboard.ts`).
The parser accepts `documentVersion: "1.8"` and runs the same node upgrade.
Scratchpad and recent documents go through `loadDocument`. 1.7 and older stay
unsupported.

### 3. Editor command surface

The per-field paint descriptors in `styles/style-descriptors.ts` (`fill`,
`stroke`, `strokeWidth`, cap, join, miter) are deleted with no aliases.

| Method | Meaning |
| --- | --- |
| `addFill(nodeIds?)` | Push a solid fill (top fill color, else black). |
| `addStroke(nodeIds?)` | Push a 2-unit black stroke. |
| `addEffect(kind, nodeIds?)` | Push an effect (`"drop-shadow"`: black, 25%, offset 0/8, blur 16). |
| `updateAppearanceLayer(slot, patch, nodeIds?)` | Patch one layer. Descriptors clamp and canonicalize. |
| `removeAppearanceLayer(slot, nodeIds?)` | Remove one layer. |
| `moveAppearanceLayer(slot, toIndex, nodeIds?)` | Reorder within its list. |
| `setAppearance({ appearance?, effects? }, nodeIds?)` | Replace whole stacks for automation, AI, paste style, and mixed replace. |

- `slot` is `{ list: "fills" | "strokes" | "effects"; index }`. `nodeIds`
  defaults to the selection.
- A vector resolves to its child paths for fills and strokes, as
  `setSelectionProperty` does today, and to itself for effects.
- `getSelectionPropertiesSnapshot` gains `appearance`: the shared stack with
  per-field `isMixed`, or `isMixed: "structure"` when list lengths or kinds
  differ.
- Scrubs and live previews reuse `markHistoryStep`/`commitHistoryStep`
  (`use-property-scrub-history.ts`), giving one undo step per gesture.
- Selection colors (`inspection/selection-colors.ts`) list and replace solid
  colors, gradient stop colors, and shadow colors.

### 4. Engine-owned render plan

`packages/engine/src/appearance/` builds an `AppearanceRenderPlan` per node from
geometry, appearance, effects, and opacity. The plan is plain data. Paint is
removed from every geometry output: signatures, vector render entries, and the
stroke inflation inside geometry builders. The plan reads appearance from the
node, never from geometry records.

What the plan contains:

- **Geometry.** All of the node's paths merged into one `d`, with glyph
  translates baked in. Warped text is already one path.
  - Every stroke now paints above every fill across glyphs, as it would on one
    text object.
  - This is a deliberate visible change for straight text whose glyphs overlap
    (negative tracking). Today a later glyph's fill covers an earlier glyph's
    stroke.
- **Paint box.** The unstroked geometry bbox in node-local units.
- **Gradients.** `userSpaceOnUse` coordinates mapped from the normalized
  `start`/`end` through the paint box. A box that collapses on one axis maps
  that axis to 0. A zero-length gradient vector paints the last stop as solid.
- **Shadow filter.**
  - Region (`userSpaceOnUse`): stroke ink ∪ every shadow rect (offset ± 1.5 ×
    blur). It covers `SourceGraphic` as well as the shadows.
  - `color-interpolation-filters="sRGB"`.
  - Chain: `SourceAlpha → feGaussianBlur → feOffset → feFlood →
    feComposite in`, then `feMerge(shadows…, SourceGraphic)`.
- **Layers.** Ordered draw records with paint, width, join, cap, miter, and
  opacity.
- **Opacity.** Node opacity is a group opacity on the composited node, so
  overlapping fill and stroke never show through each other. Ancestor group
  opacity becomes nested group opacity in export. Canvas keeps its per-leaf
  ancestor multiplication, which is identical for one leaf.
- **Ink bounds.** See §6.

How each consumer renders the plan:

| Consumer | Rendering |
| --- | --- |
| Canvas `node-render-tree.tsx` | `<AppearanceDefs>` and `<AppearanceLayers>`. Geometry appears once as `<path id>` in defs and layers are `<use href>`. Def ids are `pp-<useId>-<def><i>`, scoped per mount, so the hidden original and the text-edit preview never collide. |
| Text inline-edit preview | Same components, fed preview geometry. Its hard-coded paint goes away. |
| Dense group surfaces (`getGroupNodeArtState`) | Each leaf contributes its plan. The surface frame unions the leaves' ink bounds. |
| SVG export | Serializes one concrete `<path>` per layer (no `<use>`), with deterministic ids, color plus `fill-opacity`/`stroke-opacity` instead of `rgba()`, and nested `<g opacity>`. |
| PNG export | Unchanged. Chrome rasterizes the plan-built SVG, so PNG is the parity target. External SVG consumers may render filters differently, which is accepted. |
| Font-not-loaded fallback (`canvas-fallback-text.tsx`) | Paints the first enabled solid fill and stroke only. The state is transient, and export already blocks on missing fonts. |

**Live color preview.** The `--pp-paint-*` variables are keyed by layer slot
instead of the color value (`getPaintVariableName` hashes the value today), so
previewing a black shadow cannot recolor a black stroke. `stop-color` and
`flood-color` accept `var()` through `style`.

### 5. Caching and invalidation

- Plans are memoized per node on (geometry identity, appearance identity,
  effects identity, opacity). Document nodes are immutable, so unrelated edits
  reuse every plan. `CanvasNodeArt` memoizes on plan identity, and one
  appearance edit re-renders one node.
- With paint out of signatures, a color, gradient, or shadow edit no longer
  rebuilds geometry or vector surfaces.
- A vector surface still recompiles for appearance changes of its last child
  when `pathComposition` is compound/boolean, because the compiled result
  takes that child's stack. The plan, not the surface, carries that stack.
- Drag: shells keep moving by `translate3d` with `will-change`. Offsets are
  node-local, so a rotation preview rotates the shadow with the node and the
  filter is not rebuilt per frame.
- Pan: the viewer transform only.
- Zoom: Chrome re-rasterizes filters at the new scale. This is the main
  performance risk, and stage 0 measures it before any schema work.
  - Tight filter regions bound the cost.
  - If the budget fails, the sanctioned fallback comes from
    [Interaction render hot path](interaction-render-hot-path.md): hold the
    rasterized layer during active zoom and re-raster on settle. This is a
    render strategy only.

### 6. Bounds and hit testing

| Extent | Includes | Used by |
| --- | --- | --- |
| Paint box | unstroked geometry | gradients |
| Selection frame | paint box + max enabled stroke width / 2 (today's stroke-inflated frame) | selection chrome, transform, snapping, hit candidate gate |
| Ink bounds | selection frame ∪ shadow rects | `getNodeRenderFrame` (shell size), filter region, dense surface frame |

- Stroke and effect extents come from a pure `getAppearanceExtents`, which
  runs on top of cached geometry instead of inside geometry builders.
- Shadows never select. The shell's hit `<button>` (`canvas-node.tsx`) is
  trusted by leaf pointer-down without a geometry test
  (`node-interactions.ts`), so it is sized to the selection frame, not the
  shell.
- `createPaintedHitRegion` (`primitives/node-geometry.ts`):
  - `filled` = any enabled fill, at any opacity.
  - Stroke distance uses the widest enabled stroke.
  - A node with no enabled paint hit-tests by its paint box, so it can never
    become unselectable.
- Artboard clipping already uses negative insets relative to the shell
  (`artboard-clip-path.ts`), so larger shells still clip exactly to the
  artboard.
- Group resize (`primitives/group-resize.ts`) keeps today's split.
  - Shape and text: stroke widths and shadow offset/blur scale by the existing
    `strokeWidth` factor.
  - Path and vector: both resize through `transform.scaleX/Y`, so strokes and
    shadows scale with the node and receive no explicit scaling.

### 7. Panel UI

`components/panels/properties/appearance/` replaces `appearance-fields.tsx`
with a compound family. Each part reads `useEditorValue` locally.

```tsx
<Appearance.Root>                    // selection appearance snapshot + node Opacity
  <Appearance.List list="fills">     // title + add
    <Appearance.Item index={i}>      // drag handle, visibility toggle, remove
      <Appearance.PaintField />      // solid ↔ linear; ColorPickerField + gradient strip
      <Appearance.OpacityField />
    </Appearance.Item>
  </Appearance.List>
  <Appearance.List list="strokes"> … <Appearance.StrokeFields /> …
  <Appearance.List list="effects"> … <Appearance.ShadowFields /> …
  <Appearance.Mixed />               // "Mixed appearance — use first"
</Appearance.Root>
```

- Reordering uses `components/ui/sortable-list.tsx`.
- Numbers use `ScrubSlider` and `NumberField` with the existing draft rules
  ([Properties](../product/properties.md)).
- The gradient strip edits stops and angle. There are no canvas gradient
  handles in v1.

### 8. Performance budget

All three scenarios share one fixture builder in
`apps/web/src/performance/benchmarks/`:

- 200 shape and text nodes inside one `4500 × 5400` artboard.
- Each node has a linear fill, two strokes, and a drop shadow (blur 24,
  offset 0/12).
- A `-plain` control variant uses the same geometry with one solid fill.

| Scenario | Interaction | Gate |
| --- | --- | --- |
| `appearance-viewport-200` (+ `-plain`) | zoom ladder 100→50→35→21→10→5→1% and pan (pattern of `large-svg-viewport`) | p95 ≤ 1.25 × plain p95; max settle frame ≤ 50 ms |
| `appearance-dragging-200` | drag all 200 (pattern of `shape-nodes-dragging-500`) | p95 ≤ 8.33 ms; `renderCanvasNode` ≤ 5 during the drag |
| `appearance-shadow-scrub` | scrub one blur for 60 frames | p95 ≤ 8.33 ms; ≤ 1 node-art render per frame; zero renders during stop-color preview |

- New registry labels: span `render.appearance.plan` and counter
  `render.appearance.planBuilds`.
- Gates live in a performance spec, following `drag-render-path.spec.ts`.
- The stage-0 commit records baselines.

### 9. Test plan

**Editor contract**

| Test | Covers |
| --- | --- |
| `appearance-migration` | 1.8 fixtures for every family, a 1.8 clipboard payload, the round trip, and rejection of 1.7 |
| `appearance-commands` | add, update, remove, move, and set; one undo step each; clamping; vector child resolution; structural mixed; effects cleared on compound and join |
| `appearance-render-plan` | layer order, glyph merge, gradient mapping and degenerate axes, filter region ⊇ ink, opacity grouping |
| `appearance-bounds` | paint ⊆ selection ⊆ ink; hit regions; group-resize scaling per family |
| `appearance-svg-export` | every `url(#…)` resolves, well-formed XML, no `rgba()` attributes, node opacity < 1 with fill + stroke exports as group opacity |
| `appearance-preserved-by-conversion` | shape → path, boolean ops (`getStyleTemplateFromNode`), `mergeCurves` style equality, SVG import of solid paint |
| `appearance-selection-colors` | stop and shadow colors are listed and replaced |

**Playwright**

- `appearance-panel.spec.ts`: add, reorder, toggle, and remove through the
  panel. Scrub is one undo step. Covers mixed-structure replace, and checks
  that a black-shadow preview leaves a black stroke untouched.
- `appearance-hit-testing.spec.ts`: clicking a shadow selects nothing, and the
  hover outline equals the selection frame.
- `appearance-visual-sweep.spec.ts`: DPR 2 and 1 over the zoom ladder
  `[1, 0.5, 0.35, 0.21, 0.1, 0.05, 0.01]`, decoded in-page. It ports the
  capture helpers from the branch-only raster sweep. Assertions:
  - the shadow band is present and unclipped at the shell and artboard edges
  - the stroke has its full width
  - gradient luminance is monotonic
  - the result is the same after serialize → reload
- `appearance-export-parity.spec.ts`: a DPR 1, 100% canvas screenshot against
  `renderSvgToPngBlob` of the same artboard, within a per-channel tolerance.
- Stage 1 pixel test: 1.8 fixtures render the same before and after
  migration. Overlapping-glyph text is excluded per §4.

**Fuzz** (seeded PRNG, no new dependency)

- Engine: seeded random command sequences. After each step:
  - the document validates
  - undo restores the exact prior document
  - export refs resolve
  - paint ⊆ selection ⊆ ink
  - vector children have no effects
- UI: one short seeded Playwright walk over the panel, including invalid
  drafts and Escape. After each step the panel equals the editor snapshot and
  there are no console errors.

Edge cases:

- **Numeric extremes:** width 0, 0.01, and 1000; blur 0 and 500; offset ±5000;
  blank and negative drafts.
- **Visibility:** opacity 0 everywhere, every layer disabled, full lists
  (8/8/4).
- **Gradients:**
  - stop counts: 2 and 8
  - stop offsets: duplicate or unsorted
  - geometry: `start === end`, a horizontal line path
  - color: `rgba` stops
- **Text:**
  - empty, warped, or tight negative tracking
  - font not loaded
  - inline editing with a full stack
- **Transforms:** rotated, flipped, and non-uniformly scaled nodes; group
  resize per family.
- **Containment and visibility:**
  - shadow crossing an artboard edge
  - hidden node or ancestor
  - dense imported group
  - compound and boolean vectors with differing child stacks
- **Clipboard and history:** paste between tabs, paste of a 1.8 payload, undo
  across load.
- **Zoom:** 1% and 6400% with blur 500.

### 10. Non-goals (v1)

- **Paint:** radial gradients, blend modes, pattern or image fills.
- **Effects:** inner shadow and layer blur.
- **Strokes:** inside or outside alignment, gap outlines, dashes, variable
  width, expand-stroke.
- **Ordering:** interleaved fill and stroke ordering.
- **Light direction:** world-space ("global light") shadow direction.
- **Containers:** appearance on groups or artboards (`background` stays).
- **Editing:** canvas gradient handles, per-character styling.
- **Import:** SVG import of gradients and filters (still dropped).
- **Images:** image effects.
- **Rendering:** viewport culling.

## Stages

Each stage is shippable. Each one is test-first and gated by `bun run check`,
`bun run typecheck`, targeted `test:editor`, targeted Playwright, and
`perf:json`.

0. **Baseline and spike.** Add the fixture builder, the `-plain` scenarios,
   and the ported sweep helpers. A throwaway spike measures 200 SVG-filter
   shadows across the zoom ladder. It is the go/no-go for SVG filters.
1. **Schema, migration, solid stacks.**
   - `appearance` replaces the flat fields, with the 1.9 migration and
     clipboard upgrade.
   - Add commands and delete descriptors.
   - Paint leaves geometry.
   - The plan drives the canvas, the edit preview, and export.
   - The panel family covers solid lists and node opacity.
2. **Linear gradients.** Paint union, userSpace defs, the gradient strip, stop
   colors in selection colors, and sweep and parity extensions.
3. **Drop shadow.** Effects list, filter plan, ink vs selection frames, button
   sizing, dense-surface frames, and the perf gates. If zoom fails its budget,
   the settle-raster quality mode ships in the same stage.
4. **Later, each its own proposal.** Outside and inside stroke alignment. The
   preferred route is an engine-compiled offset outline, not clip and mask,
   which seam at antialiased edges. After that: image shadows and radial
   gradients.

## Consequences

- One plan builder replaces four divergent paint renderers. Canvas/export
  parity becomes a test.
- Paint edits stop invalidating geometry and vector surfaces.
- Schema versioning gains one sanctioned upgrade step (1.8 → 1.9).
- The fixed fills-then-strokes order is the expensive choice to reverse:
  interleaving would reshape saved data.
- Straight text with overlapping glyphs paints strokes above all fills.
- Many-filter zoom cost depends on Chrome re-raster behavior, measured in
  stage 0 before schema commitment.
