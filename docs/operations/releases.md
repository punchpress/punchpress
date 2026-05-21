---
summary: Defines the full PunchPress release sequence from version selection through changelog, validation, tags, GitHub Release notes, desktop publish, and updater checks.
read_when:
  - preparing a complete PunchPress release after version scope is known
  - changing release scripts, changelog policy, tags, GitHub Release creation, or desktop publish order
  - validating S3 updater artifacts or a packaged app after publish
---

# Releases

PunchPress releases synchronize package versions, changelog entries, Git tags,
GitHub Releases, and Electron desktop artifacts.

## Release Surfaces

Keep these on the same `X.Y.Z`:

- `CHANGELOG.md` top `vX.Y.Z` heading
- `apps/desktop/package.json`
- `apps/web/package.json`
- Git tag `vX.Y.Z`
- GitHub Release title `vX.Y.Z`
- GitHub Release notes copied from the matching changelog entry

Do not maintain a persistent `## Unreleased` section. Update `CHANGELOG.md`
only during release prep.

Tag pushes mark the canonical release commit. They do not publish GitHub Release
notes or desktop artifacts.

## SemVer Policy

- Do not proactively mention version bumps for ordinary compatible changes.
- Always call out backward-incompatible changes and suggest a bump.
- If the user asks for a bump without specifying semver, inspect unreleased
  commits and choose the bump. Ask only when genuinely ambiguous.
- For breaking changes, recommend `minor` while PunchPress is `0.x.y`; recommend
  `major` for `1.x.y+`.

Prefer clean breaks over compatibility layers unless the user asks otherwise.

## Prerequisites

- Repo `.env` contains `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`,
  `APPLE_TEAM_ID`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`.
- Release Mac has the Apple `Developer ID Application` certificate.
- S3 bucket `punchpress-electron-app-209596837609-us-east-1-an` allows public
  `s3:GetObject` for published updater artifacts.
- Release branch contains only intended release changes.

## Dependency Update Gate

Release dependency changes must stay locked and reviewable:

- Keep direct dependency versions exact.
- Keep `bunfig.toml` frozen by default.
- Use `package.json` `overrides` only for known transitive-risk mitigation or
  toolchain compatibility. Avoid broad overrides that cross incompatible major
  ranges for transitive consumers.
- Before committing any dependency update, refresh `bun.lock`, run
  `bun install --force`, then run `bun audit --audit-level=moderate`.
- If `bun pm scan` is configured, run it too. If no scanner is configured,
  `bun audit` is the required vulnerability gate.
- Re-run the package or release command that motivated the dependency update,
  such as `bun run build:desktop:unsigned`.

## Procedure

1. Bump the version:

```bash
bun run release:bump patch
bun run release:bump minor
bun run release:bump major
bun run release:bump X.Y.Z
```

2. Refresh the lockfile:

```bash
bun install
```

When dependency pins or overrides need to change, temporarily thaw installs,
refresh the lockfile, restore frozen installs, and force-reinstall from the
updated lockfile before validation.

3. Collect changelog context:

```bash
bun run release:collect-changelog-context
```

Use `--since-ref <git-ref>` only when the automatic baseline is wrong.

4. Write a top `CHANGELOG.md` entry:

- heading: `## vX.Y.Z - YYYY-MM-DD`
- user-facing outcomes only
- no implementation detail unless it directly changes user behavior
- `### Added`, `### Changed`, and `### Fixed` only when they improve scanning

5. Verify release integrity:

```bash
bun run release:check
bun run build:desktop:unsigned
bun run release:check-desktop-artifacts
```

On the release Mac, also run:

```bash
bun run build:desktop
```

6. Commit, tag, and push:

```bash
git add CHANGELOG.md apps/desktop/package.json apps/web/package.json bun.lock
git commit -m "release: vX.Y.Z"
git tag -a vX.Y.Z -m "release: vX.Y.Z"
git push origin main --follow-tags
```

7. Create the GitHub Release from the pushed tag:

```bash
tmp_notes_file="$(mktemp)"
bun run release:notes -- --version X.Y.Z > "$tmp_notes_file"
gh release create vX.Y.Z --title vX.Y.Z --notes-file "$tmp_notes_file"
rm "$tmp_notes_file"
```

Do not rely on the annotated tag message as the GitHub Release body.

8. Publish desktop artifacts from the release Mac:

```bash
git checkout vX.Y.Z
bun install --frozen-lockfile
bun run build:desktop
bun run publish:desktop
```

9. Validate the published updater feed:

- confirm `latest-mac.yml`, the DMG, ZIP, and blockmap exist in S3 under the
  `mac/` prefix
- install or update from a prior packaged PunchPress build and verify the
  updater downloads the new release

## Fast Failures

| Symptom | Check |
| --- | --- |
| Missing Apple variables | Load repo `.env` before signed build or publish. |
| Missing AWS variables | Load repo `.env` before `bun run publish:desktop`. |
| Notarization failed | Verify app-specific password, Team ID, and active Developer ID cert. |
| S3 `403` | Verify bucket policy and Electron Builder `acl: null` publishing. |

Keep release commits narrow: changelog, package versions, lockfile, and required
release workflow docs.
