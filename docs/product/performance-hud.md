---
summary: Defines the in-app PunchPress performance HUD and panel as a product surface for live frame timing, diagnostics, benchmark runs, and automation parity.
read_when:
  - changing the Settings performance panel, floating HUD, live frame chart, benchmark controls, or structured benchmark result display
  - debugging performance tools that distort idle responsiveness or disagree with automated benchmark output
  - deciding what performance data users and maintainers should see in the app
---

# Performance HUD

PunchPress includes an in-app performance panel for inspecting responsiveness
and running repeatable performance checks.

## Access

- The performance panel is available inside the app.
- `Cmd/Ctrl+Shift+P` toggles it during editing.
- A compact floating HUD may show the same measurement surface.

## Live View

- The live view shows recent frame timing while the editor is in use.
- Slow frames are visible without relying on a single aggregate FPS value.
- The HUD stays lightweight enough that leaving it open does not meaningfully
  distort the responsiveness it measures.
- Charts render from pre-aggregated buckets rather than reprocessing raw frame
  history on every update.
- Diagnostics correlate slow frames with instrumented editor work, browser
  timeline events, hidden windows, recurring timers, animation frames, and idle
  callbacks when available.
- Context such as visible node count or selected node count helps interpret the
  data.

## Benchmarks

- Named benchmarks can run from the panel.
- Benchmarks create deterministic scenes and interactions.
- Users can run one benchmark or a suite.
- Results are structured and remain inspectable after completion.
- The app and automation share the same benchmark definitions.
- Command-line benchmark traces are the artifact form of flame-chart
  inspection.
- The flame chart separates `Measured PunchPress Work` from `Unattributed Time`
  so slow frames do not imply the remainder is OS or idle time.
