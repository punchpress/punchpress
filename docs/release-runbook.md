# Release Runbook

Canonical process for synchronized version bumps, tag-based release tracking, and Electron desktop publishes.

## Goal

Keep these release surfaces synchronized to one `X.Y.Z`:

- `CHANGELOG.md` (`vX.Y.Z` heading)
- `apps/desktop/package.json`
- `apps/web/package.json`

Changelog policy:

- Do not maintain a persistent `## Unreleased` section.
- Update `CHANGELOG.md` only during version bump/release prep.

## SemVer Prompt Policy (Agent Behavior)

- Do not proactively mention version bumps for non-breaking changes.
- If a change is backward-incompatible, always mention it and suggest a version bump.
- If the user asks for a version bump/release without specifying semver, inspect the unreleased
  commit range and choose the bump automatically. Only ask if the correct bump is genuinely
  ambiguous.
- Breaking-change guidance:
  - `0.x.y` -> recommend `minor`.
  - `1.x.y+` -> recommend `major`.

Compatibility posture:

- Prefer clean breaks over compatibility layers.
- Do not add legacy aliases/fallbacks unless explicitly requested.

## Prerequisites

- Repo-root `.env` has valid `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`.
- The release Mac has a valid Apple `Developer ID Application` certificate in Keychain.
- The S3 bucket `punchpress-electron-app-209596837609-us-east-1-an` is configured for public `GetObject` access.
- Release branch has only intended release changes.
- AI command playbook: `docs/ai-commands/version-bump/README.md`.

## 1. Bump Version (One Command)

From repo root, run exactly one of:

```bash
bun run release:bump patch
bun run release:bump minor
bun run release:bump major
bun run release:bump X.Y.Z
```

This command updates:

- synchronized desktop/web package versions
- it does not update `CHANGELOG.md`

Then refresh lockfile:

```bash
bun install
```

## 2. Build Changelog Entry (AI-Assisted)

Collect deterministic commit context:

```bash
bun run release:collect-changelog-context
```

Optional baseline override:

```bash
bun run release:collect-changelog-context --since-ref <git-ref>
```

Then draft `CHANGELOG.md` entry manually using AI judgment:

- add top heading `## vX.Y.Z - YYYY-MM-DD`
- summarize user-facing outcomes from commits
- write for end users, not developers
- write like product release notes, not engineering notes
- prefer exciting but concrete language when a release introduces meaningful user-visible changes
- avoid implementation details unless they directly change user behavior
- use `### Added`, `### Changed`, and `### Fixed` only when those headings make the entry easier to scan
- for short, launch-style release notes, prefer a simple flat bullet list with no forced categories

## 3. Verify Release Integrity

Run from repo root:

```bash
bun run release:check
bun run build:desktop:unsigned
bun run release:check-desktop-artifacts
```

On the release Mac, also validate the signed build before tagging:

```bash
bun run build:desktop
```

## 4. Commit + Tag (Source of Truth)

After verification:

```bash
git add CHANGELOG.md apps/desktop/package.json apps/web/package.json bun.lock
git commit -m "release: vX.Y.Z"
git tag -a vX.Y.Z -m "release: vX.Y.Z"
git push origin main --follow-tags
```

Tag `vX.Y.Z` is the canonical commit boundary for that build.

## 5. GitHub Release Notes (Auto)

Pushing tag `vX.Y.Z` triggers `.github/workflows/release-integrity.yml` to:

- run release metadata validation
- build the unsigned desktop artifacts
- validate the generated Electron updater outputs
- extract the matching `## vX.Y.Z - YYYY-MM-DD` section from `CHANGELOG.md`
- publish that extracted markdown as the GitHub release body

This keeps GitHub release notes human-readable and aligned with the changelog source of truth.

## 6. Publish Desktop Release

Only after the release commit has been pushed to `origin/main`.

From repo root on the release Mac:

```bash
git checkout vX.Y.Z
bun install --frozen-lockfile
bun run build:desktop
bun run publish:desktop
```

This uploads the DMG, blockmap, and `latest-mac.yml` updater metadata to S3.

## 7. Final Validation

- Confirm `latest-mac.yml` and the DMG exist under `s3://punchpress-electron-app-209596837609-us-east-1-an/mac/`.
- Confirm the GitHub release for tag `vX.Y.Z` contains the matching changelog entry.
- Install or update from a prior PunchPress build to verify the auto-updater downloads the new release.

## Fast Failure Handling

- `APPLE_*` missing: load the repo `.env` before signed build/publish.
- `AWS_*` missing: load the repo `.env` before `bun run publish:desktop`.
- `notarization failed`: verify Apple app-specific password, Team ID, and active Developer ID cert.
- `403`/S3 access errors: verify bucket policy, keep ACL block settings enabled, and confirm Electron Builder is publishing with `acl: null`.
- Keep release scope tight: only version files, lockfile, changelog, and required release docs/workflow updates.
