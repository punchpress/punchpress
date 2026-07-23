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
- Flame charts should use product and architecture labels rather than benchmark
  fixture labels.
- Resident Raster strokes target 60 FPS, first visible feedback within 16.7 ms,
  no more than two frames of visual lag, no Brush-owned main-thread stall over
  50 ms, and pointer release within 50 ms.

See [Performance HUD](performance-hud.md), [Benchmarks](benchmarks.md), and
[Performance operations](../operations/performance.md).
