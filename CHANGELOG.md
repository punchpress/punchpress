# Changelog

All notable changes to this project will be documented in this file.

## v0.7.0 - 2026-05-27

### Added

- Performance diagnostics now include durable large-SVG interaction benchmarks for tracking dense vector drag behavior over time.

### Changed

- Imported SVG artwork is much faster to select, hover, drag, resize, rotate, zoom around, and recolor, especially for deeply nested vector files.
- Group, vector, and shape transforms now use steadier transform frames, so rotated and resized artwork stays aligned with its selection handles.
- Drawing and resizing shape layers feels more direct, with less preview jitter while dragging.

### Fixed

- Complex SVG imports now preserve more visible appearance details, including opacity and nested vector rendering cases that previously looked wrong.
- Dense layer trees and selection color summaries no longer cause broad panel refreshes during common canvas interactions.
- Desktop development installs now repair missing Electron binaries more reliably in fresh worktrees.

## v0.6.0 - 2026-05-21

### Added

- Artboards are now first-class framed production surfaces with canvas frames, layer icons, property controls, clipping behavior, and export boundaries.
- Workspace tabs let you keep a scratchpad and file-backed documents open side by side, with new-file presets and unsaved-change prompts.

### Changed

- Editor controls are more consistent across the properties panel, color picker, sliders, segmented controls, and select fields.
- Text-on-circle editing is easier to discover, with path edit actions in the inspector and toolbar plus a clickable selected-circle guide.

### Fixed

- New text placement now stays centered on the click point more reliably.
- Circle path editing now exits from outside clicks, keeps text size stable while resizing the path, and preserves visible text dragging behavior.
- Desktop release packaging now uses refreshed vulnerability-scanned dependency pins so mac artifacts build reliably from a clean install.

## v0.5.0 - 2026-04-30

### Added

- Vector editing is broader and more direct, with stronger point, curve, corner, and compound-path workflows for refining artwork without leaving the canvas.
- SVG imports now come in with more of their editable structure intact, so imported vector artwork behaves more like native PunchPress layers.
- Canvas hit testing is more precise across text, shapes, groups, and vector artwork, making selection and edit-mode entry feel more predictable.

### Changed

- Canvas overlays, hover previews, cursors, and transform handles now share a cleaner visual system that makes selection, editing, and drag feedback easier to read.
- Layers and context menus expose more vector operations where you are already working, including clearer compound-vector actions and edit controls.
- Text tracking and circular text path editing are smoother, with steadier panel controls and better layout behavior while adjusting type.

### Fixed

- New text placement preloads the default font before measuring, so inserted text lands in the right spot more reliably.
- Undoing a pen path now steps back point by point while drawing on the page.
- Detailed vector and text editing sessions have fewer rough edges around hover feedback, path guides, and selection state.

## v0.4.0 - 2026-04-16

### Added

- Draw and refine editable vector artwork with a much fuller pen-and-points workflow, including anchor and handle editing, multi-point selection, point insertion and deletion, path closing and joining, and live corner rounding on eligible paths.
- Combine overlapping shapes and vector artwork with Unite, Subtract, Intersect, and Exclude, while keeping the result editable for further path work.
- Import supported `.svg` artwork directly into the current document as editable vector layers instead of treating it like a flattened asset.

### Changed

- Shape and vector path editing now feel like one coherent system, with clearer `Edit path` controls, better nested vector layer behavior, and inspector controls that make mixed-color selections easier to retouch.
- Canvas interaction polish is noticeably stronger across path editing, transforms, hover feedback, and zooming, with cursor language that does a better job signaling what will happen before you click.
- The Mac app now wires more editor actions into the native menu flow, making core document commands feel more at home on desktop.

### Fixed

- Corner-radius editing on vector paths is steadier at its limits, so precise rounding work is less likely to jump or destabilize.
- Inserted text lands centered under your click, and the dark seam that could appear across the canvas has been removed.
- Pen hover states, anchor feedback, and panel labels are more consistent during detailed vector editing sessions.

## v0.3.0 - 2026-03-26

### Added

- Group layers together, drill into grouped artwork, and move or transform grouped selections without breaking your layout apart.
- Create and edit shape layers directly on the canvas with dedicated placement controls, resize handles, and shape properties in the inspector.
- Bend text more freely with inline warp controls, circular text paths, and scrub-based sliders that make fine adjustments much faster.
- Use the new performance panel to inspect drag benchmarks, run soak checks, and spot slow-frame issues while tuning heavier documents.

### Changed

- Canvas transforms now feel more direct and reliable, with editor-owned selection overlays and steadier drag, resize, rotate, and hover behavior.
- Property panel controls and focus states are more polished across the editor, making common adjustments easier to scan and tweak.
- Desktop builds now keep the in-app update indicator polished while preserving app quit flows more reliably on macOS.

### Fixed

- New text starts straight instead of picking up a default warp before you ask for one.
- The text caret stays visible more consistently while editing on the canvas, and the pointer tool returns after text placement as expected.
- Font and color picker interactions are cleaner, settings dialogs dismiss properly on outside click, and dark panel text is easier to read.

## v0.2.2 - 2026-03-13

- Fixed mac desktop auto-updates so released builds can detect and download new versions reliably again.
- Published updater metadata now points at the ZIP feed the app uses for in-place updates, while the DMG remains available for manual installs.

## v0.2.1 - 2026-03-13

- PunchPress now shows a compact in-app indicator while a desktop update is downloading, so you can see progress without leaving the canvas.
- When an update finishes downloading, the app keeps a restart action in the titlebar lane so you can install it later instead of losing the prompt.

## v0.2.0 - 2026-03-13

### Added

- Browse fonts installed on your Mac directly in PunchPress and swap missing fonts before export instead of guessing replacements.
- Pick text colors with a full color picker in the properties panel for faster visual tuning.
- Reopen recent PunchPress documents from the desktop app with clearer recent-file controls.

### Fixed

- Text editing now stays aligned with the editable frame, which makes in-place text updates much more predictable.

## v0.1.0 - 2026-03-12

- PunchPress is here.
- Create layered print-on-demand designs on an infinite canvas with editable text and expressive warped text effects.
- Save your work as PunchPress files, reopen recent projects quickly, and export finished SVG artwork when you're ready to produce.
- Open `.punch` files directly from Finder and use a signed Mac app that can keep itself up to date automatically.
