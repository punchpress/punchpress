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
