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
- The live view should make slow frames obvious instead of relying on a single
  aggregate FPS number.
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
