# AI Command: Do A Version Bump

Use this workflow when the user says: `do a version bump`.

This command intentionally splits work into:

- deterministic scripts for version math and validation
- AI judgment for changelog curation from commit history

## Deterministic Scripts

- `bun run release:bump <patch|minor|major|X.Y.Z>`
- `bun run release:notes [-- --version X.Y.Z]`
- `bun run release:collect-changelog-context [--since-ref <git-ref>] [--max-commits <N>]`
- `bun run release:check`
- `bun run build:desktop:unsigned`
- `bun run release:check-desktop-artifacts`

## AI Responsibilities

After collecting commit context, the AI must:

- infer user-facing outcomes from commit subjects/diff context
- remove noise (internal cleanup/churn) unless user-visible
- call out breaking changes explicitly
- write in end-user product language, not developer implementation language
- write like product release notes: clear, concrete, and a little lively when appropriate
- use `### Added`, `### Changed`, and `### Fixed` only when they genuinely help readability

The changelog should reflect product impact, not raw commit order.

## Command Procedure

1. Infer bump type first.
If the user did not specify a bump, inspect the unreleased commit range and choose `patch`,
`minor`, `major`, or an explicit version automatically. Only ask a follow-up question when the
correct bump is genuinely ambiguous.

2. Run deterministic bump.

```bash
bun run release:bump <patch|minor|major|X.Y.Z>
```

3. Refresh lockfile.

```bash
bun install
```

4. Collect commit context.

```bash
bun run release:collect-changelog-context
```

If automatic commit baseline is wrong, rerun with:

```bash
bun run release:collect-changelog-context --since-ref <git-ref>
```

5. Draft changelog entry with AI judgment.
Insert a new top entry in `CHANGELOG.md`:

- heading: `## vX.Y.Z - YYYY-MM-DD`
- concise bullet points focused on user-facing changes
- no implementation-detail bullets unless they directly matter to users
- prefer benefit-first phrasing over dry verbs like `Add` when a more natural release-note sentence works better
- use section headings only when they improve scanning; otherwise write a clean flat list of bullets

Do not add or keep `## Unreleased`.

6. Run validation/build checks.

```bash
bun run release:check
bun run build:desktop:unsigned
bun run release:check-desktop-artifacts
```

On the release Mac, also run:

```bash
bun run build:desktop
```

7. Commit, tag, and push release changes first.

```bash
git add CHANGELOG.md apps/desktop/package.json apps/web/package.json bun.lock
git commit -m "release: vX.Y.Z"
git tag -a vX.Y.Z -m "release: vX.Y.Z"
git push origin main --follow-tags
```

8. Create the GitHub Release from the pushed tag.
Use the changelog entry body as the GitHub Release notes instead of relying on the tag annotation.

```bash
tmp_notes_file="$(mktemp)"
bun run release:notes -- --version X.Y.Z > "$tmp_notes_file"
gh release create vX.Y.Z --title vX.Y.Z --notes-file "$tmp_notes_file"
rm "$tmp_notes_file"
```

9. Publish after push by default.
If the user asked for a version bump/release and did not scope it down, continue through desktop
publish after the release commit is pushed to `origin/main`. Only stop short of publish if the
user explicitly says not to publish.

```bash
git checkout vX.Y.Z
bun install --frozen-lockfile
bun run build:desktop
bun run publish:desktop
```

10. Report completion.
Summarize:

- new version
- changelog highlights
- GitHub Release URL/status
- files changed
  - whether checks passed

For macOS updater releases, make sure the publish step includes the ZIP artifact alongside the
DMG so `latest-mac.yml` can point to the ZIP feed used by `electron-updater`.

## Editing Rules

- Keep package versions synchronized: desktop and web.
- Keep `CHANGELOG.md` top release version equal to package versions.
- Do not keep a persistent `## Unreleased` section.
