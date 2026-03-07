# Punchpress

**AI-powered design tool for Print on Demand.**

Punchpress is a design editor where AI creates fully editable, print-ready graphics — not flat images you can't touch, but living designs you can tweak, restyle, and export for any product.

Think of it as what happens when you cross Kittl with an AI that actually understands graphic design.

---

## Workspace layout

The repo is organized as a small Bun workspace so the app and desktop shell stay independent:

- `apps/web` contains the actual Punchpress editor and can run as a normal Vite web app on its own.
- `apps/desktop` contains the Electrobun wrapper that points at the web app in development and bundles its production build for desktop distribution with CEF.

## Development

- `bun install` installs all workspace dependencies.
- `bun run dev` starts the standalone web app.
- `bun run dev:desktop` starts the Electrobun shell against the web app dev server.
- `bun run build:web` builds the web app only.
- `bun run build:desktop` builds the desktop app. The first desktop build downloads the Electrobun runtime and bundled CEF binaries for the current platform.

---

## The problem

Print on Demand designers today are stuck between two bad options:

**Option A: AI image generators.** Tools like Midjourney or DALL-E can produce stunning visuals, but the output is a flat raster image. You can't edit the text. You can't adjust the arc on a headline. You can't swap a color or fix a typo without regenerating the whole thing. And the output often can't meet POD print specs.

**Option B: Manual design tools.** Kittl, Canva, Illustrator. Full creative control, but you're doing everything by hand. Every letter spacing tweak, every color choice, every layout decision. It's slow, and it doesn't scale.

There's no tool that combines AI generation with real editability. You either get AI output you can't edit, or manual tools that AI can't drive.

---

## What Punchpress does

Punchpress closes that gap. AI generates a complete design — text, layout, effects, warps, colors, assets — but instead of outputting a flat image, it produces an **editable design recipe**. Every element stays live. You can:

- **Change any text** after generation — fix a typo, swap a phrase, try a different slogan
- **Adjust warps and effects** — drag an arc wider, tune a wave, tweak a shadow
- **Restyle anything** — change colors, swap fonts, adjust stroke weights
- **Move and resize elements** — full spatial control, just like a real design tool
- **Re-generate selectively** — ask AI to redo just the headline, or just the icon, without touching the rest
- **Export print-ready files** — clean vector SVG and high-DPI PNG that POD platforms actually accept

The AI doesn't generate pixels. It generates designs.

---

## Who it's for

**POD sellers and creators** who want to produce more designs, faster, without sacrificing quality or editability. Whether you're running a merch brand, a print shop, or selling on Etsy/Redbubble/Merch by Amazon — Punchpress lets you go from idea to print-ready file in minutes instead of hours.

**Designers who want AI as a collaborator**, not a replacement. Punchpress gives you a starting point you can actually work with — not a black-box image you have to take or leave.

---

## How it works (the user experience)

1. **Describe what you want.** "Retro varsity badge layout, arced text saying BROOKLYN ATHLETICS, distressed texture, navy and gold."

2. **AI generates an editable design.** Not an image — a real design with selectable, movable, editable elements. Text is live. Effects have adjustable parameters. Everything is layered.

3. **Tweak it in the editor.** Drag elements around. Change the headline. Make the arc tighter. Swap navy for forest green. Try a different font. The editor feels like Kittl or Figma — a proper design workspace with a dark UI, property panels, and visual controls.

4. **Export for print.** One click to get a print-ready SVG (outlined vector paths, no font dependencies) or a 300 DPI PNG. The output is clean enough for any POD platform.

5. **Save and iterate.** Your design is stored as a lightweight recipe. Come back tomorrow, change "BROOKLYN" to "PORTLAND", re-export. The design is never baked.

---

## Core capabilities

### Warped and styled text
The bread and butter of POD design. Arced headlines, wavy text, circular layouts, flag effects — all fully editable. Change the text and the warp recomputes. This isn't SVG `<textPath>` — it's outlined vector geometry that exports like Illustrator.

### Vector editing
Full bezier path editing — anchor points, control handles, direct selection — for precise control over shapes and letterforms. Double-click into any element to enter vector edit mode and manipulate individual path segments, just like Illustrator's pen tool and direct selection tool.

### AI-generated assets
Icons, illustrations, badges, decorative elements — generated or sourced by AI and composable as layers in the design. These sit alongside editable text, not baked into it.

### Parametric templates
The most successful POD designs follow patterns: arced slogan + icon + bottom text, badge layout, varsity/collegiate, retro sunset, minimalist wordmark. Punchpress ships a library of parametric templates that AI can populate and customize. Templates aren't rigid — they're starting points with knobs the AI (and user) can turn.

### Print-ready export
Every design exports as clean vector SVG with all text outlined as paths — no font embedding issues, no rendering inconsistencies across platforms. Optional PNG export at any DPI. The exported SVG can optionally embed the original design recipe in metadata, so re-importing into Punchpress restores full editability.

### Design management
Browse, search, duplicate, and organize your designs. Batch-edit across variations. Build a library.

---

## What makes this different

**It's not an image generator with an editor bolted on.** The AI and the editor share the same underlying representation. There's no "convert AI output to editable format" step — the AI output *is* the editable format.

**It's not a template tool with AI fill-in-the-blanks.** AI can compose freely, choosing layouts, combining elements, making creative decisions. Templates are one tool in the kit, not the whole product.

**Editability is the architecture, not a feature.** The entire system is built around the principle that nothing is baked until the user hits export. Text is always text. Warps are always parameters. Effects are always adjustable. This isn't a constraint — it's the core product advantage.

---

## Technical highlights

_A brief summary of key architectural decisions for engineers and AI assistants working on implementation._

### Architecture

**Design recipe as source of truth.** Every design is stored as a JSON document (a "scene graph") describing layers, text, fonts, colors, warp parameters, effects, and layout. The renderer is a pure function of this document. The editor manipulates this document. The AI generates this document. This is the single representation that flows through the entire system.

**LLM generates validated JSON, not code.** The AI produces structured JSON conforming to the document schema — not React code, not SVG markup. This gives us safety (no arbitrary code execution), determinism (same input → same output), and reliability (schema validation catches errors before rendering).

**Bi-directional state.** The JSON document drives the canvas, and canvas interactions (drag, edit, adjust) write back to the JSON document via patches. Neither a code editor nor the visual canvas is "primary" — they're both views of the same state.

### Text & warp engine

**Text rendered as outlined glyph paths.** Fonts are loaded in-browser via opentype.js. Each character is converted to SVG `<path>` outlines — identical to "Create Outlines" in Illustrator. The text string and font settings are preserved in the recipe, so outlines can be regenerated at any time.

**Warp as a parameter, not a bake.** Warp transforms (arch, wave, circle, flag, distort, mesh) are stored as parameters in the recipe and applied at render time. Editing the warp or the text re-runs the pipeline. Geometry is only flattened to final outlines on export.

**Two-class warp system.** Placement warps (circle, path) reposition glyphs with rigid transforms — fast, perfect quality. Deformation warps (arch, wave, flag, distort, mesh) bend the actual geometry by flattening curves to points, warping through a mapping function, and rebuilding paths.

### Editor interaction layer

**Composable interaction primitives, not a monolithic framework.** The editor shell is assembled from small, focused, MIT-licensed libraries from the daybrush ecosystem that are designed to work together:

- **react-infinite-viewer** — infinite canvas with zoom, pan, and scrolling
- **react-moveable** — drag, resize, rotate, scale, snap, and warp handles on any DOM/SVG element
- **react-selecto** — drag-to-select (lasso) across elements

This gives us a tldraw/Figma-quality interaction feel without depending on a monolithic canvas framework. Moveable wraps whatever we render (SVG paths, images, groups) with interaction chrome. The rendering itself is entirely ours.

**Two-layer editing model (like Illustrator).** Object-level editing (select tool — drag, resize, rotate whole elements) is handled by Moveable. Path-level editing (pen tool / direct selection — edit anchor points and bezier handles) is a separate mode powered by Paper.js. Double-click into an element to enter vector edit mode; click away to return to object mode.

### Vector editing

**Paper.js** provides the bezier path editing foundation — anchor point manipulation, control handles, path boolean operations (unite, intersect, subtract), path simplification, and SVG import/export. Paper.js renders to a `<canvas>` overlay that activates when entering vector edit mode for a specific element. Edits are written back to the SVG path data in the document store.

### State management

**Zustand** with Immer middleware. A single store holds the document state (nodes array), editor state (selected element, active tool, zoom), and UI state. Zustand's selector-based subscriptions ensure that dragging one element doesn't re-render the property panel or other elements. The `zundo` middleware provides undo/redo via a patch history stack.

### Export pipeline

**Export bakes the recipe.** Export converts all text to outlined paths, expands strokes, flattens effects, and produces a self-contained SVG. Optionally embeds the original recipe in `<metadata>` so the file can be re-imported with full editability restored.

### Desktop distribution

**Electrobun + CEF** wraps the React web app for desktop distribution. Electrobun runs the desktop main process on Bun and bundles Chromium Embedded Framework so the desktop shell uses the same rendering engine across macOS, Windows, and Linux. The app still ships as a web app first; desktop packaging remains additive, not a rewrite.

---

## Technology stack

| Layer | Technology | License | Purpose |
|---|---|---|---|
| UI framework | React + TypeScript | MIT | Application shell, components, property panels |
| Styling | Tailwind CSS | MIT | Design system, dark theme |
| State | Zustand + Immer + zundo | MIT | Document store, undo/redo, granular subscriptions |
| Infinite canvas | react-infinite-viewer | MIT | Zoom, pan, scrollable viewport |
| Object interaction | react-moveable | MIT | Drag, resize, rotate, snap handles |
| Selection | react-selecto | MIT | Lasso / click selection |
| Vector editing | Paper.js | MIT | Pen tool, bezier handles, boolean ops, path editing |
| Font engine | opentype.js | MIT | Font loading, glyph outlines, kerning |
| Warp engine | Custom | — | Flatten → warp → rebuild SVG path pipeline |
| Desktop shell | Electrobun + CEF | MIT | Native app packaging, Bun main process, bundled Chromium runtime |

---

## Project status

Currently in proof-of-concept phase. The PoC validates the core technology: font loading → glyph outlining → warp transforms → editable SVG output, inside a minimal interactive editor. Production features like AI generation, templates, vector editing tools, asset management, and collaboration come after the core rendering pipeline is proven.
