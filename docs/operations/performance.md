---
summary: Describes PunchPress performance workflows for in-app capture, benchmark runners, Chrome traces, Electron traces, and regression diagnosis.
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

## In-App Panel

Use the in-app performance panel for manual inspection.

- Reach it from Settings.
- Use the keyboard shortcut when iterating quickly.
- Inspect the rolling recent-frame view and the last benchmark summary.
- Run one benchmark or the benchmark suite from the app when visual inspection
  matters.

## Web Commands

```bash
bun run test:performance
bun run test:performance:headed
bun run test:performance:benchmark --list
bun run test:performance:benchmark <benchmark-id>
bun run test:performance:benchmark --json <benchmark-id>
bun run test:performance:benchmark:headed <benchmark-id>
bun run test:performance:trace
```

`test:performance:trace` captures a Chrome trace for the first newly captured
slow frame. Set `PUNCHPRESS_STOP_ON_FIRST_SLOW_FRAME=0` to continue for the
full run instead.

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
| Chrome trace | `.context/performance/` trace output from the headed trace run |
| Desktop idle soak | `.context/performance/desktop-idle-soak-2min-snapshot.json` |
| Desktop trace | `.context/performance/desktop-idle-soak-2min-trace.json` |

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
