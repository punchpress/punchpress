# Canvas Overlay Visual System Plan

This document captures the cleanup plan for PunchPress canvas overlay visuals.
It is intended to be executed in a separate workspace as a focused
architecture-and-refactor pass.

## Problem

PunchPress has the right high-level overlay architecture direction now:

- the engine owns overlay state and policy
- React owns the centralized overlay stack
- specialized edit backends like Paper stay bounded to edit-only behavior

The remaining weakness is the visual system layered on top of that structure.

Today, similar overlay affordances are still implemented in multiple different
ways:

- some visuals use shared semantic tokens in `apps/web/src/styles/global.css`
- some visuals live in small shared modules under
  `apps/web/src/components/canvas/canvas-overlay/`
- some visuals still hardcode stroke colors, opacities, and widths inside
  feature files
- Paper-based vector editing chrome still resolves and composes its own visual
  values locally

This creates a few recurring problems:

- similar affordances drift apart visually over time
- theme and style tuning requires touching multiple unrelated files
- feature work tends to create one more special-case renderer instead of
  extending a shared visual primitive
- the overlay system is structurally centralized, but its visual language is
  not yet centralized enough

Examples of the current drift:

- path hover preview and selected hidden-path ghost were separate renderers
  until very recently
- text path guide styling still lives locally in
  `canvas-text-path-overlay.tsx`
- vector Paper chrome still owns a substantial amount of its own style
  composition in `paper-session-render.ts`

## Desired Output Structure

The desired end state is not “all styling in one file”. The desired end state
is a small, clear visual system for overlay chrome.

The output structure should look like this:

### 1. Semantic Canvas Tokens

`apps/web/src/styles/global.css`

This should be the home for durable semantic overlay tokens, for example:

- preview path stroke
- selection outline stroke
- guide stroke
- handle accent
- warning/destructive overlay colors
- hover halo colors

These should represent product-level visual roles, not one-off component names.

### 2. Shared Overlay Visual Primitives

`apps/web/src/components/canvas/canvas-overlay/`

This area should own shared visual primitives used by more than one overlay,
for example:

- path-preview SVG renderer
- bounds-outline renderer
- selection-outline renderer
- shared handle/guide appearance helpers

Feature overlays should compose these primitives instead of restyling similar
shapes from scratch.

### 3. Feature Overlays That Consume Shared Visuals

Feature overlays should remain responsible for behavior and geometry, but not
for inventing their own visual language.

Examples:

- hover preview
- hidden selected-path ghost
- text path guide
- transform overlays
- vector edit overlay chrome

These can still remain separate feature files. The important rule is that they
pull from shared semantic tokens and shared visual primitives.

### 4. Specialized Edit Backends Stay Specialized

Edit-only systems such as the vector Paper backend may keep local geometry and
interaction logic, but they should consume the same semantic visual system.

That means:

- no parallel color vocabulary
- no separate preview stroke language
- no local “close enough” versions of shared overlay styles

### 5. Specs Describe UX Consistency, Not Implementation

`docs/specs/`

Product specs should define the expected visual consistency:

- which affordances are part of the same visual family
- when they should match
- when they should intentionally differ

Implementation detail belongs in architecture docs, not specs.

## Solution Direction

The solution is to formalize a shared overlay visual system on top of the
overlay architecture we already established.

Concretely:

- keep overlay mounting centralized
- keep overlay state in engine queries
- move semantic visual values into shared tokens
- move repeated SVG/HTML overlay visuals into shared primitives
- make feature overlays compose those primitives
- make Paper-based edit chrome consume the same token set

This is not a purely aesthetic cleanup. It improves maintainability by making
future overlay work cheaper and more predictable.

## tldraw Comparison

tldraw is useful here because it solves a similar class of problems without
turning every overlay into its own mini-architecture.

Relevant source references:

- `DefaultCanvas.tsx`
  <https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/components/default-components/DefaultCanvas.tsx>
- `EditorComponentsContext.tsx`
  <https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/hooks/EditorComponentsContext.tsx>
- `CanvasShapeIndicators.tsx`
  <https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/components/default-components/CanvasShapeIndicators.tsx>
- `DefaultShapeIndicator.tsx`
  <https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/components/default-components/DefaultShapeIndicator.tsx>
- `DefaultSelectionForeground.tsx`
  <https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/components/default-components/DefaultSelectionForeground.tsx>
- `DefaultHandles.tsx`
  <https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/components/default-components/DefaultHandles.tsx>

The useful lessons from tldraw are:

### Centralized Overlay Stack

tldraw mounts overlay layers from one canvas composer instead of letting each
feature invent its own rendering stack.

PunchPress should keep following this direction through `canvas-overlay/`.

### Explicit Overlay Extension Surface

tldraw exposes named overlay surfaces through `EditorComponentsContext`.
That makes it clear where shared overlays belong and where customization hooks
fit.

PunchPress already has a centralized overlay stack, but the visual primitives
inside that stack are still less formalized than they should be.

### Shared Visual Components For Repeated Roles

tldraw has dedicated components for repeated roles such as:

- shape indicators
- selection foreground
- handles

The important point is not the exact component names. The point is that one
visual role gets one reusable home.

PunchPress should do the same for preview paths, selection outlines, guide
paths, and similar overlay visuals.

### Semantic Styling Instead Of Per-Feature Restyling

tldraw’s default overlay pieces read like parts of one system rather than
separate feature experiments.

PunchPress should move closer to this by defining a shared semantic vocabulary
for overlay visuals and reusing it consistently.

## Work Plan

This should be executed as a bounded cleanup pass, not as a long-running
drip-feed of small opportunistic tweaks.

### Phase 1. Inventory The Overlay Visual Roles

Identify the core visual roles used by canvas overlays today:

- bounds hover
- path hover preview
- selected hidden-path ghost
- object selection outline
- transform box lines and handles
- text guide path
- vector edit guide path
- anchor and bezier handle chrome
- warning / destructive limit states

Goal:

- a short mapping from visual role to current implementation files
- agreement on which roles should share one visual family

### Phase 2. Define Semantic Overlay Tokens

Add or normalize semantic tokens in `global.css` for the overlay vocabulary.

Goal:

- durable token names for preview, guide, selection, handle, hover, and warning
  roles
- no new hardcoded overlay colors for these roles in feature files

### Phase 3. Extract Shared Overlay Primitives

Create or expand shared primitives under `canvas-overlay/` for repeated visuals.

Initial expected targets:

- path preview renderer
- shared bounds / outline renderer
- shared guide-path renderer
- shared handle appearance helpers where practical

Goal:

- similar visuals stop reimplementing their own SVG/HTML structure

### Phase 4. Migrate Existing Overlays

Move existing overlays onto the shared primitives and tokens.

Suggested order:

1. hover preview and hidden selected-path ghost
2. text path guide visuals
3. transform outline and related object selection chrome
4. vector edit Paper chrome appearance

Goal:

- one visual language across all common overlay states

### Phase 5. Reconcile Paper Chrome

Keep Paper as the edit backend, but stop treating it as a separate styling
system.

Goal:

- `paper-session-render.ts` consumes shared semantic tokens and shared visual
  rules
- Paper-only logic remains about geometry and interaction, not about owning a
  second overlay brand system

### Phase 6. Add Focused Regression Coverage

Add high-signal tests that protect the shared visual system from drifting again.

Suggested coverage:

- hover path preview still appears
- selected hidden compound child still shows ghost path
- text guide path still renders in both passive and active states
- vector path editing still shows the expected guide/anchor chrome

These tests do not need to exhaustively assert every style value. They should
assert the presence and shared usage of the intended primitives where practical.

### Phase 7. Reconcile Specs And Docs

After the cleanup lands:

- update the relevant architecture docs if the resulting structure is sharper
  than today’s description
- keep product behavior in `docs/specs/`
- do not leave visual consistency rules undocumented

## Non-Goals

This pass is not meant to:

- redesign the editor visual language from scratch
- replace Paper path editing with a different backend
- push every geometry-specific value into CSS
- create a huge abstraction layer before there is a clear repeated role

The goal is tighter consistency and easier tuning, not abstraction for its own
sake.

## Expected Result

When this work is done, PunchPress should have:

- one centralized overlay stack
- one clear semantic token vocabulary for canvas overlay chrome
- a small set of shared overlay visual primitives
- feature overlays that mostly compose those primitives
- Paper edit chrome that visually belongs to the same system

That should give us a better long-term foundation for themeing, polish, and new
overlay features without reintroducing special-case drift.
