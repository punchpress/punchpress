---
summary: Describes PunchPress performance workflows for in-app capture, benchmark runners, browser traces, Electron traces, and regression diagnosis.
read_when:
  - measuring drag, overlay, render, or idle cost in the real editor
  - debugging a slow-frame regression or comparing browser headroom to editor overhead
  - changing benchmark registration, performance HUD capture, or trace workflows
---

# Performance

Use the performance workflow when PunchPress needs repeatable measurements of
real interaction cost.

## Model

Performance testing has three parts:

| Part | Contract |
| --- | --- |
| In-app recorder | Captures frame timing, counters, slow-frame diagnostics, and benchmark summaries. |
| Benchmark registry | Defines deterministic setup and run steps used by both humans and automation. |
| Browser or desktop runner | Triggers the app benchmark path and collects structured results. |

The app is the source of truth for performance data. Automation triggers the
app and collects the app's result instead of reimplementing timing logic.

Timing-focused tests still live under the performance test tree. Keep helper
unit coverage for frame summaries, buffers, diagnostics, and controllers in
`apps/web/tests/performance/unit`; keep browser-backed interaction and benchmark
checks in `apps/web/tests/performance`.

Use [Performance tests](../reference/performance-tests.md) as the exact label,
artifact, and trace contract.

## In-App Panel

Use the in-app performance panel for manual inspection.

- Reach it from Settings.
- Use `Cmd/Ctrl+Shift+P` when iterating quickly.
- Inspect the rolling recent-frame view and the last benchmark summary.
- Run one benchmark or the benchmark suite from the app when visual inspection
  matters.

## Web Commands

```bash
bun run test:performance:unit
bun run test:performance
bun run test:performance:headed
bun run perf --list --json
bun run perf:json <benchmark-id>
bun run perf:flame <benchmark-id>
bun run perf:trace <benchmark-id>
bun run perf:headed <benchmark-id>
bun run test:performance:trace
```

`test:performance:unit` runs timing infrastructure checks without launching a
browser. `perf:json` is the normal agent path for one scenario. `perf:flame`
retains timestamped flame spans in the result artifact. `perf:trace` also
retains flame spans and writes a browser trace next to the benchmark result.

`test:performance:trace` captures a browser trace for the first newly captured
idle slow frame. Set `PUNCHPRESS_STOP_ON_FIRST_SLOW_FRAME=0` to continue for
the full run instead.

## Desktop Commands

```bash
bun run test:performance:desktop
bun run test:performance:desktop:trace
```

Desktop runs build the Electron main/preload bundle before launching the app.
Set `PUNCHPRESS_SKIP_DESKTOP_BUILD=1` only when iterating against an existing
build.

## Artifacts

| Run | Artifact |
| --- | --- |
| Web benchmark | `.context/performance/<benchmark-id>-result.json` |
| Web benchmark snapshot | `.context/performance/<benchmark-id>-snapshot.json` |
| Web benchmark trace | `.context/performance/<benchmark-id>-trace.json` |
| Idle slow-frame trace | `.context/performance/idle-soak-2min-trace.json` |
| Desktop idle soak | `.context/performance/desktop-idle-soak-2min-snapshot.json` |
| Desktop trace | `.context/performance/desktop-idle-soak-2min-trace.json` |

Treat trace JSON as the CLI equivalent of an in-app flame chart. The app panel
is better for live inspection; the CLI trace is better for attaching evidence
to a performance change.

## Targeted Rendering Benchmarks

Targeted rendering work should compare before and after results from the same
machine, browser mode, fixture, and benchmark options. Local absolute numbers
are noisy; same-machine deltas are the useful signal.

Dense SVG, vector render, and canvas pan work should record:

- import or setup time
- frame summary: FPS, p50, p95, max frame, and slow frame count
- editor node count and selected node count
- mounted canvas wrapper count
- mounted layer row count
- rendered SVG path count when relevant
- slow-frame diagnostics when max or p95 frames regress

Resize performance work should also run the shared resize benchmark:

```bash
bun run perf:json large-svg-resize
```

This scenario loads the large SVG fixture, selects the imported root
container, and drives the editor resize session for a deterministic frame pass.
Use it to compare aggregate resize preview and commit changes before relying on
manual resize feel.

Rotation performance work should also run the shared rotation benchmark:

```bash
bun run perf:json large-svg-rotate
```

This scenario loads the large SVG fixture, selects the imported root
container, zooms out, and drives the editor rotation session for a deterministic
frame pass. Use it to compare aggregate rotation preview and commit changes
before relying on manual rotation feel.

Node-tool path editing work should run both path-point drag benchmarks:

```bash
bun run perf:json simple-vector-path-point-drag
bun run perf:json large-svg-path-point-drag
```

The simple scenario isolates ordinary path edit overhead. The large SVG scenario
keeps imported artwork mounted while one editable path anchor moves, exposing
render and panel fanout that is easy to miss in small documents.

Prefer pointer-path benchmarks for interaction claims. Direct engine drag
benchmarks isolate editor command cost, but they do not cover canvas pointer
handlers, coordinate conversion, or browser input dispatch.

Use one benchmark loop for each optimization:

1. Run the targeted benchmark and save the artifact.
2. Implement one architecture change.
3. Add or update the correctness test that proves behavior did not change.
4. Rerun the targeted benchmark with the same options.
5. Keep the change only when the correctness test passes and the benchmark
   result explains the tradeoff.

## Regression Workflow

When a benchmark regresses:

1. Reproduce with the shared benchmark runner.
2. Compare against a simpler browser-only control scene for the same rough
   visual workload.
3. Disable or isolate large editor surfaces such as overlays.
4. Capture a trace after the benchmark shape is understood.
5. Fix the layer that changed the cost rather than rewriting unrelated node or
   panel code.

Use a small number of high-signal benchmarks. Do not benchmark every editor
interaction.
