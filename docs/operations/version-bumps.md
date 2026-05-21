---
summary: Defines the AI-specific PunchPress version bump contract: semver inference, changelog judgment, deterministic scripts, and handoff to the full release runbook.
read_when:
  - the user asks to do a version bump
  - changing bump scripts, changelog-context extraction, package-version synchronization, or AI release-note guidance
  - deciding what judgment an agent owns before following the full release sequence
---

# Version Bumps

Use this workflow when the user says `do a version bump`.

Version bumps split deterministic scripts from AI judgment:

- scripts perform version math, metadata updates, release-note extraction, and
  validation
- the agent curates user-facing changelog notes from commit context

## Scripts

| Task | Command |
| --- | --- |
| Bump version | `bun run release:bump <patch\|minor\|major\|X.Y.Z>` |
| Collect commit context | `bun run release:collect-changelog-context` |
| Collect context from a specific baseline | `bun run release:collect-changelog-context --since-ref <git-ref>` |
| Limit collected commits | `bun run release:collect-changelog-context --max-commits <N>` |
| Extract release notes | `bun run release:notes -- --version X.Y.Z` |
| Validate release metadata | `bun run release:check` |
| Build unsigned desktop package | `bun run build:desktop:unsigned` |
| Check desktop artifacts | `bun run release:check-desktop-artifacts` |

## Agent Judgment

If the user did not specify a bump, inspect unreleased commits and choose
`patch`, `minor`, `major`, or an explicit version. Ask only when the correct
bump is genuinely ambiguous.

Changelog entries must:

- describe user-facing outcomes
- remove internal cleanup noise
- call out breaking changes
- avoid implementation detail unless users directly feel it
- use `Added`, `Changed`, and `Fixed` headings only when they help scanning
- avoid a persistent `Unreleased` section

## AI Procedure

1. Infer the bump type.
2. Run `bun run release:bump <patch|minor|major|X.Y.Z>`.
3. Run `bun install`.
4. Run `bun run release:collect-changelog-context`.
   Use `--since-ref <git-ref>` when the automatic baseline is wrong.
   Use `--max-commits <N>` when the range is too broad for a useful changelog
   pass.
5. Write the `CHANGELOG.md` top entry as `## vX.Y.Z - YYYY-MM-DD`.
6. Hand off to [Releases](releases.md) for validation, commit, tag, GitHub
   Release, desktop publish, and updater validation.

At minimum, validation begins with:

```bash
bun run release:check
bun run build:desktop:unsigned
bun run release:check-desktop-artifacts
```

See [Releases](releases.md) for the full release sequence.

## Editing Rules

- Keep web and desktop package versions synchronized.
- Keep the changelog top release equal to package versions.
- Stage only explicit release files.
- Use `release: vX.Y.Z` as the release commit message.
