# Performance Panel

PunchPress includes a built-in performance panel for inspecting editor
responsiveness and running repeatable performance checks.

## Product Expectations

- The performance panel is available inside the app and does not depend on a
  URL parameter or external tooling.
- The panel is reachable from Settings under a developer-facing section.
- PunchPress also provides a keyboard shortcut to open or toggle the
  performance panel quickly during active editing.
- The panel may appear as a compact floating HUD while still being available
  from Settings.

## Live Performance View

- The panel shows a live view of recent frame timing while the editor is in
  use.
- The live view should stay lightweight enough that leaving the panel open for
  a while does not meaningfully distort the editor responsiveness it is meant
  to measure.
- The live chart may stay visible for visual feedback, but it should render
  from pre-aggregated buckets rather than reprocessing raw frame history on
  every update.
- The always-on docked HUD should behave like a measurement surface rather
  than normal app UI: coarse refresh cadence, minimal React involvement, and
  enough isolation that it does not create the idle spikes it is showing.
- The live view should make slow frames obvious instead of relying on a single
  aggregate FPS number.
- The live view should help explain slow frames, including whether they
  correlate with instrumented editor work, browser timeline events, or a
  hidden/unfocused window state.
- The panel should correlate slow frames with recent recurring renderer tasks
  such as timers, animation-frame loops, or idle callbacks.
- The panel should break recent frame cost into meaningful categories so users
  can understand where time is going during interaction.
- The panel should surface enough context to interpret the data, including
  document scale such as visible node count or selected node count.

## Benchmarks

- PunchPress includes named performance benchmarks that can be run on demand
  from the performance panel.
- Benchmarks set up deterministic scenes and interactions so repeated runs are
  comparable.
- A benchmark run reports a structured result rather than only a visual chart.
- Users can run a single benchmark or a broader suite from the panel.
- Benchmark results should remain inspectable after the run finishes.

## Automation

- The same benchmark definitions used in the app should also be runnable
  through automated tooling.
- Automated benchmark runs should produce structured results suitable for
  release checks and historical comparison.
- PunchPress should avoid maintaining one benchmark path for the app and a
  different benchmark path for automation.
