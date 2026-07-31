---
summary: Defines PunchPress performance test labels, span events, artifacts, budgets, and browser trace integration.
read_when:
  - adding performance instrumentation, benchmark scenarios, flame-chart artifacts, or frame-budget gates
  - renaming performance labels or deciding whether a measurement belongs in app code or benchmark code
  - debugging mismatch between in-app performance spans, CLI artifacts, and browser trace output
---

# Performance Tests

Performance tests answer three questions:

- Did an editor workflow stay inside its frame budget?
- Which frames were slow?
- Which product or architecture boundary made those frames slow?

They are for repeatable timing work. They are separate from product behavior
tests, but they use the real editor whenever possible so command-line runs, the
performance pane, and trace artifacts describe the same system.

## Run Them

| Command | Use |
| --- | --- |
| `bun run test:performance:unit` | Fast unit tests for performance buffers, summaries, hooks, and controller behavior |
| `bun run perf --list` | List benchmark scenarios |
| `bun run perf --list --json` | List benchmark scenarios as `{ id, label, description }` |
| `bun run perf <id>` | Run one benchmark scenario from the command line |
| `bun run perf:json <id>` | Print the benchmark result payload for CLI inspection |
| `bun run perf:flame <id>` | Include flame-chart spans in the JSON result |
| `bun run perf:trace <id>` | Include flame spans and a browser trace artifact |

Humans can also run scenarios from the in-app performance pane. Agents should
prefer the command line because it is repeatable and produces artifacts.

### Diagnostic Options

`bun run perf`, `perf:json`, `perf:flame`, and `perf:trace` accept targeted
diagnostic options:

| Option | Use |
| --- | --- |
| `--frames <count>` | Run fewer or more benchmark frames while isolating a bottleneck |
| `--node-count <count>` | Override supported benchmark fixture size |
| `--timeout-ms <ms>` | Give intentionally slow diagnostics enough time to complete |

Default scenario options are the baseline. Diagnostic overrides are still
first-class CLI support: use them to narrow slowness, and include the options
shown in the result artifact when comparing runs.

## Agent Workflow

Use the CLI for normal performance work. Do not open or click around in the app
unless the task is specifically about the performance pane UI.

1. Discover scenarios with `bun run perf --list --json`.
2. Run the target scenario with `bun run perf:json <id>`.
3. Inspect `summary`, `spans`, `counters`, `nodeStats`, and artifact paths.
4. Re-run with `bun run perf:flame <id>` when frame summaries say a scenario is
   slow and span timing is needed.
5. Re-run with `bun run perf:trace <id>` only when app spans do not explain the
   slowness.

## What You Get

| Artifact | Contract |
| --- | --- |
| `<id>-result.json` | Benchmark result, summaries, counters, and flame spans when `--flame` or `--trace` is used |
| `<id>-snapshot.json` | Full performance controller snapshot after the run |
| `<id>-trace.json` | Browser trace JSON with PunchPress marks when `--trace` is used |

The in-app performance pane is the live inspection surface. It should show
frame-level slowness and let the user inspect which spans contributed to the
slow frame.

## Terms

| Term | Meaning |
| --- | --- |
| Benchmark scenario | A repeatable workflow such as dragging 500 text nodes or resizing a large SVG |
| Frame sample | One rendered frame with duration, counters, and span buckets |
| Span | One timed product or architecture boundary with `startMs`, `endMs`, `durationMs`, and nesting depth |
| Counter | A counted value such as rendered canvas nodes or visible layer rows |
| Flame span | A timestamped span retained so the pane or JSON artifact can draw a flame chart |
| Measured PunchPress Work | A derived flame-chart row covering the app spans retained for the selected frame |
| Unattributed Time | Frame time not covered by retained PunchPress spans |
| Browser trace | Browser trace output enriched with PunchPress marks |
| Budget | A pass/fail threshold, usually the 120 FPS frame budget |

## Label Registry

All performance labels live in `PERF_SPANS` and `PERF_COUNTERS` in
`packages/engine/src/perf/perf-labels.ts`. That file is the exhaustive registry
of labels the app may emit.

Span labels use dot-separated, lower-camel architecture names:

| Label family | Use |
| --- | --- |
| `pointer.move.handle` | App-owned pointer event handling |
| `pointer.down.hitTest.deep` | Canvas pointer boundary work |
| `selection.select.apply` | Selection command boundaries |
| `selection.bounds.compute` | Selection frame or bounds computation |
| `selection.appearance.aggregate` | Selection properties, colors, and mixed values |
| `transform.drag.update` | Move, resize, rotate, and active transform work |
| `viewport.pan.update` | Pan, zoom, and viewport focus work |
| `render.canvasNode` | Render counters or render spans |
| `render.canvas.react` | React render work for canvas stage content |
| `store.selection.reduce` | Store update and reducer work |
| `import.svg.parse` | SVG import normalization work |
| `document.load.apply` | Document load or insertion work |

The table above is a reader guide to the naming scheme, not the full list. Add
new labels to the registry first, then use the registry constant at the call
site.

Labels describe stable product or architecture boundaries. Do not put benchmark
scenario names into span labels. For example, `large-svg-resize` is a
valid benchmark id, but `largeSvg.resize` is not a valid app span.

## Events

Performance capture records:

- frame samples with duration, counters, and span buckets
- timestamped spans with `label`, `startMs`, `endMs`, `durationMs`, `depth`,
  and optional `frameId`
- benchmark results with summaries, counters, node stats, span summaries, and
  flame spans
- browser trace marks when browser trace capture is enabled

Aggregated summaries are for quick pass/fail and comparison. Timestamped spans
are the source for flame charts.

## Flame Chart Terms

The flame chart starts with the selected frame duration. Under it, the pane
derives two high-level rows:

- `Measured PunchPress Work` covers the retained PunchPress spans for that
  frame. It is a UI summary, not an emitted span label.
- `Unattributed Time` covers the remaining frame duration. It may be browser
  layout, paint, compositing, scheduling, vsync wait, garbage collection, OS
  noise, or PunchPress work that is not instrumented yet.

Do not call the remainder OS time or idle time. The app does not know that.
Use browser trace only when the retained PunchPress spans do not explain a slow
frame.

## Benchmark Scenarios

Benchmark scenarios may use fixture names because they name repeatable workflows:
`large-svg-resize`, `text-nodes-dragging-50`, and similar ids are valid
benchmark metadata.

Benchmark code should call editor/product operations and let instrumentation
inside those operations emit spans. If a benchmark needs to wrap a whole
operation because no architectural span exists, add the span at the operation
boundary instead.

Raster adapter gates:

| Scenario | Contract |
| --- | --- |
| `raster-canvas2d-strokes` | Runs pixel zoom, common Hard Round, large Eraser, and extreme zoom-out on one resident `4500 × 5400` Raster. |
| `raster-canvas2d-extreme-diagonal` | Runs the full-target 4%-zoom diagonal alone for flame and browser-trace capture. |
| `raster-frame-brush` | Draws one rapid default Hard Round stroke through the canvas pointer-event path across an initially empty `4500 × 5400` Frame at 12% zoom. |
| `raster-frame-brush-stable-plane` | Repeats `raster-frame-brush` after corner marks have expanded the Raster content bounds. Compare the pair to detect latency caused by content-bound growth rather than brush work. |
| `raster-high-zoom` | Pans a resident `4500 × 5400` Frame/Raster at 12,800% with exact samples and the Frame-local pixel grid visible. |
| `raster-high-zoom-brush` | Draws a continuous 24 px Hard Round curve on a resident `720 × 720` Raster at 1,097% and verifies exact displayed pixels track the working surface. |

Raster spans cover surface decode, Stroke begin, first Dab, Dab application,
commit, cancel, and pointer release. Counters report Dabs, dirty pixel area,
direct-presentation updates, and visual-lag frames.

`raster-large-image-held-brush.spec.ts` is the browser budget gate for a
sustained 106 px Hard Round stroke on a `5000 × 5000` Raster at 15% zoom. It
also measures edge crossing, re-entry, and subsequent interior input to prevent
boundary-triggered stroke replay or a permanent renderer downgrade. Its long
diagonal excursion verifies both bounded edge work and a painted interior
sample, so skipping the crossing cannot satisfy the latency gate. The same file
verifies that the canvas placement boundary retains coalesced brush samples.

`raster-frame-edge-input.spec.ts` reproduces a 149 px Hard Round gesture on a
Brush-created Raster inside a `4500 × 5400` Frame at 15% zoom. It compares a
dense center control with repeated held-pointer exits and re-entries at the
Frame edge, measuring event-to-frame and direct working-pixel visibility. The
gate also verifies sample continuity, round-cap re-entry coverage, and bounded
working-canvas expansion.

`raster-frame-edge-spatial-lag.spec.ts` reproduces a 204 px Hard Round gesture
at 17% zoom that creates a small Frame-child Raster, exits the Frame, and
re-enters far across the writable plane during the same held stroke. With
`PUNCHPRESS_NATIVE_POINTER=1`, its compositor screencast gate measures the worst
consecutive visible ink-frontier jump and verifies that the working
presentation uses sparse tiles from the first dab without monolithic canvas
expansion or replacement.

Benchmarks are scenarios, not namespaces. If a scenario exposes missing
instrumentation, fix the product boundary instead of inventing a benchmark-only
span name.

## Browser Trace

Browser trace is optional deep diagnostics for agents. Use `--trace` when a
benchmark has slow frames and the PunchPress spans are not enough to explain
where the browser spent time.

When trace capture is enabled, PunchPress spans are mirrored into
`performance.mark()` and `performance.measure()` entries with
`punchpress:<label>` names. The trace JSON lets an agent inspect browser-level
scripting, layout, paint, compositing, and long-animation-frame events alongside
PunchPress labels.

The browser trace is an adapter. The app-owned timestamped spans remain the
source of truth for the in-app pane and JSON artifacts.

## CLI Timing Path

The command-line runner starts Playwright, opens the app, opens the performance
pane, runs one benchmark scenario, then writes the controller snapshot and
result JSON.

Timings come from inside the app:

- instrumented code calls `measurePerf()`
- `measurePerf()` records `performance.now()` start and end times
- `PerformanceController` receives those durations and optional flame spans
- the controller records frame duration from `requestAnimationFrame()` deltas
- the benchmark result summarizes frames, counters, span timings, and optional
  flame spans

Node is not the timing source. It only launches the browser run and prints the
JSON result.

## Budgets

Frame budgets belong to benchmark scenarios. Span budgets belong only to stable
architecture labels with low environmental noise. Do not add a budget to every
span by default.

The 120 FPS frame budget is about 8.33 ms per frame. Use frame budgets to catch
user-visible slowness, then use spans and traces to find where that time went.
