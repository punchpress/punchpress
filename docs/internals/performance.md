---
summary: Explains performance internals for live frame capture, benchmark registry, benchmark runner, slow-frame diagnostics, runtime task recording, and URL flags.
read_when:
  - changing `apps/web/src/performance`, performance HUD components, benchmark definitions, slow-frame diagnostics, or trace flags
  - debugging benchmark output that disagrees between in-app and automated runs
---

# Performance

Performance internals keep app and automation measurements on one path.

## Owners

- performance provider owns runtime capture context
- live frame buffer and summary aggregate recent frames
- performance controller manages recorder state
- canonical span and counter labels live in the engine perf registry
- timestamped flame spans are the source for in-app and artifact flame charts
- performance API adapter mirrors active spans into browser marks and measures
- benchmark registry defines scenarios
- benchmark runner triggers registered scenarios
- slow-frame diagnostics correlate frame spikes with renderer activity
- URL flags allow isolating major editor surfaces while investigating cost

## Rule

The app produces the measurement. Automation triggers the app and collects its
structured result.

Benchmarks are scenarios, not span namespaces. Instrument editor operations at
the product or architecture boundary, then let benchmarks collect those spans.
