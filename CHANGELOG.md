# Changelog

All notable changes to this project will be documented in this file.

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
