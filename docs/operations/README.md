---
summary: Routes PunchPress maintainer workflows for development, testing, performance investigation, releases, desktop publishing, version bumps, and documentation upkeep.
read_when:
  - running repo commands or release scripts
  - debugging a failing check, benchmark, desktop publish, or version bump
  - updating operational workflow docs after package scripts or release tooling changes
---

# Operations

Operations docs describe what maintainers run, what output to expect, and how to
recover when a workflow fails.

| Workflow | Doc |
| --- | --- |
| Local setup, common commands, and development loops | [Development](development.md) |
| Choosing editor-contract, Playwright, or performance coverage | [Testing](testing.md) |
| Direct `Editor` and plain TypeScript tests | [Editor contract](editor-contract.md) |
| Browser-backed interaction tests | [Playwright](playwright.md) |
| Performance benchmarks, traces, and slow-frame diagnosis | [Performance](performance.md) |
| Version, changelog, tags, GitHub releases, and publish order | [Releases](releases.md) |
| Electron signing, notarization, S3 publishing, and updater checks | [Desktop releases](desktop-releases.md) |
| AI-assisted version bump workflow | [Version bumps](version-bumps.md) |
| Documentation rules and migration policy | [Docs policy](../docs-policy.md) |
