---
summary: Defines performance as a PunchPress product constraint for responsive canvas interaction, stable overlays, large selections, and meaningful measurement surfaces.
read_when:
  - changing interaction hot paths, canvas overlays, node rendering, benchmark scenarios, or performance HUD behavior
  - deciding whether a user-facing behavior needs performance budget or instrumentation
---

# Performance

Performance is a product behavior: the editor must remain responsive while users
move through real design work.

## Contract

- Drag, resize, rotate, pan, and zoom should stay responsive.
- Overlays should remain visually stable without dominating frame cost.
- Large selections should degrade by simpler representation before they degrade
  by latency.
- Performance measurement should use real editor paths and deterministic
  scenarios.
- The app and automation share benchmark definitions.

See [Performance HUD](performance-hud.md), [Benchmarks](benchmarks.md), and
[Performance operations](../operations/performance.md).
