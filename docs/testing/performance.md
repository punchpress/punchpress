# Performance

Use this when PunchPress needs repeatable measurements of real interaction
cost, not just correctness.

## Goals

- measure real browser-backed editor performance
- compare runs across changes with the same scene and interaction
- support both manual inspection in the app and automated CLI execution
- keep one benchmark definition path for both humans and automation

## Core Model

PunchPress performance testing has three parts:

1. an in-app performance recorder that captures frame timing, counters, and
   benchmark summaries
2. a shared benchmark registry that defines deterministic setup and run steps
3. a browser runner that can trigger those same benchmarks from automation

The app is the source of truth for performance data. Automation should trigger
benchmarks in the app and collect the app's structured result rather than
reimplementing timing logic outside the app.

## Headed Soak Runs

- Use `bun run test:performance:headed` for browser-backed performance runs
  where the app needs to stay visible while the test is running.
- Use `bun run test:performance:trace` to stop after the first newly captured
  slow frame and write a Chrome trace to `.context/performance/`.
- `apps/web/tests/performance/idle-slow-frame.spec.ts` is the `idle-soak-2min`
  scenario for the performance HUD by default.
- The test attaches the final in-app performance snapshot as JSON so slow-frame
  diagnostics can be inspected after the run.
- Slow-frame diagnostics should include nearby renderer task activity so idle
  stalls can be correlated with timers, animation-frame loops, or idle
  callbacks without immediately reaching for a full browser trace.
- Set `PUNCHPRESS_STOP_ON_FIRST_SLOW_FRAME=0` if a trace run should continue
  for the full soak duration instead of stopping after the first reproduced
  slow frame.

## Desktop Soak Runs

- Use `bun run test:performance:desktop` for an Electron-backed idle soak using
  the real desktop shell.
- Use `bun run test:performance:desktop:trace` to run the same soak while
  capturing an Electron `contentTracing` artifact from the main process.
- The desktop soak writes its snapshot to
  `.context/performance/desktop-idle-soak-2min-snapshot.json` by default.
- The desktop trace run writes its trace to
  `.context/performance/desktop-idle-soak-2min-trace.json` by default.
- Desktop runs build the Electron main/preload bundle in Playwright global
  setup before launching the app. Set `PUNCHPRESS_SKIP_DESKTOP_BUILD=1` to
  reuse an existing build while iterating.

## In-App Panel

- The performance panel lives in the app and is reachable from Settings.
- The panel may also be opened with a keyboard shortcut for faster iteration.
- The panel should show a rolling recent-frame view and a structured summary of
  the last benchmark run.
- The panel should allow running one benchmark or an entire suite manually.

## Benchmark Shape

Each benchmark should:

- have a stable id and human-readable label
- create a deterministic scene during setup
- run a deterministic interaction path
- report a structured result
- clean up after itself

Prefer a small number of high-signal benchmarks such as:

- single text-node drag
- medium multi-node drag
- large multi-node drag
- selection or overlay-heavy scenarios once those become important

## CLI Runner

- The CLI runner should execute benchmarks through the real browser path.
- Playwright is the default runner for this because the browser render path is
  part of the thing being measured.
- Playwright should trigger benchmarks through a structured browser API exposed
  by the app in test or development contexts.
- The CLI runner should collect JSON results and write them as artifacts for
  local comparison or release checks.

## Release Checks

- Performance checks should be explicit and repeatable.
- Pre-release performance steps should run the shared benchmark suite and
  compare the result against defined thresholds or a checked-in baseline.
- Release gating should focus on a small number of meaningful thresholds rather
  than trying to benchmark every interaction in the product.
