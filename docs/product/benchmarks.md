---
summary: Defines benchmark product expectations for deterministic scenes, repeatable interactions, structured results, and shared app/automation definitions.
read_when:
  - adding or changing benchmark scenarios, benchmark labels, setup steps, result summaries, or release performance checks
  - deciding whether a scenario belongs in the in-app performance panel or automated runner
---

# Benchmarks

Benchmarks make performance comparable across changes.

- Each benchmark has a stable id and human-readable label.
- Setup creates a deterministic scene.
- Run steps follow a deterministic interaction path.
- Results are structured and inspectable after the run.
- Benchmarks clean up after themselves.
- The same definitions run from the app and automation.
- Release checks should focus on a small number of meaningful thresholds.
- Timing helper tests live with performance tests even when they run without a
  browser.
- Command-line runs may emit trace JSON for flame-chart analysis.
