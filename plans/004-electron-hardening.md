# Plan 004: Harden the Electron shell (sandbox, openExternal allowlist, static-path containment)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fecf8e6c..HEAD -- apps/desktop/src-electron`
> On any drift in the three files below, re-read them before editing.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (sandbox flag can break preload assumptions; requires manual desktop verification)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `fecf8e6c`, 2026-06-10

## Why this matters

Three defense-in-depth gaps in the desktop shell. (1) The renderer runs with
`sandbox: false`, so a renderer compromise (e.g. via a malicious imported
file) escapes OS-level process isolation. (2) The window-open handler passes
**any** URL to `shell.openExternal`, including `file://` and arbitrary
protocol handlers — a classic Electron pitfall. (3) The `app://` static-file
protocol handler joins the request path onto the app directory without a
containment check; URL normalization probably blocks `../` traversal, but
"probably" is not a control. None of these is remotely exploitable on its
own — this is hardening for a local-first app that parses untrusted files
(SVG, images, clipboard payloads).

## Current state

- `apps/desktop/src-electron/main-window-controller.ts:96-103` — webPreferences:

```ts
webPreferences: {
  preload: path.join(import.meta.dirname, "../preload/preload.mjs"),
  backgroundThrottling: false,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false,          // ← target 1
  session: sharedSession,
},
```

- `apps/desktop/src-electron/main-window-controller.ts:113-116` — target 2:

```ts
nextWindow.webContents.setWindowOpenHandler(({ url }) => {
  shell.openExternal(url);
  return { action: "deny" };
});
```

- `apps/desktop/src-electron/helpers/serve-static-app.ts:30-52` — target 3.
  The handler builds `filePath` via
  `path.join(request.url.replace("app://static", appDir))`, resolves with
  `resolvePath` (fs.stat-based, strips query), falls back to
  `<appDir>/index.html`, then `net.fetch("file://" + resolvedPath)`. No check
  that the resolved path stays inside `appDir`.
- `apps/desktop/src-electron/preload.ts` — uses only `contextBridge`,
  `ipcRenderer`, `process.env` / `process.versions`, and type imports. These
  are all available in a **sandboxed** preload (Electron polyfills a limited
  `require` for `electron` and exposes `process` there), so `sandbox: true`
  is expected to be compatible. Verify, don't assume.
- There is no existing unit-test harness for `src-electron` code. Desktop
  behavior is verified by running the shell.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Env setup (FIRST — install/app-run fail without it) | `cp ~/Programming/punchpress/.env .` | `.env` exists at repo root (gitignored; never commit it) |
| Install | `bun install --frozen-lockfile` | exit 0 |
| Run desktop dev | `bun run dev:desktop` | window opens, editor loads |
| Lint | `bun run check` | exit 0 |
| Desktop perf smoke (exercises packaged-ish startup) | `bun run test:performance:desktop` | passes (only if it passed before your change — check first) |

## Scope

**In scope**:
- `apps/desktop/src-electron/main-window-controller.ts`
- `apps/desktop/src-electron/helpers/serve-static-app.ts`
- `apps/desktop/src-electron/helpers/external-links.ts` (create — URL policy helper)

**Out of scope**:
- `preload.ts` API surface, IPC handler signatures — no behavior changes.
- The auto-updater (`helpers/app-updater.ts`) — electron-updater validates
  macOS code signatures by default; audited and accepted as-is.
- Renderer/web code (`apps/web`).
- electron-builder.yml, signing, entitlements.

## Git workflow

- One commit per target is fine, or a single
  `fix: harden electron shell defaults`. Conventional Commits.
- Do NOT push unless the operator instructed it.

## Steps

### Step 1: Allowlist external URL opening

Create `apps/desktop/src-electron/helpers/external-links.ts`:

```ts
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["https:", "http:", "mailto:"]);

export const isAllowedExternalUrl = (url: string) => {
  try {
    return ALLOWED_EXTERNAL_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
};
```

In `main-window-controller.ts`, change the window-open handler to:

```ts
nextWindow.webContents.setWindowOpenHandler(({ url }) => {
  if (isAllowedExternalUrl(url)) {
    shell.openExternal(url);
  }
  return { action: "deny" };
});
```

Also check this file (and grep `src-electron` broadly) for other
`shell.openExternal` call sites and `will-navigate` handling; route any other
untrusted-URL `openExternal` through the same helper. If a call site's URL is
app-internal/constant (e.g. opening the releases page), leave it.

**Verify**: `grep -rn "openExternal" apps/desktop/src-electron` → every call
on a non-constant URL goes through `isAllowedExternalUrl`. `bun run check` →
exit 0.

### Step 2: Contain the app:// static handler

In `serve-static-app.ts`, after computing the final `resolvedPath` (including
the `.html` and `index.html` fallbacks), enforce containment before
`net.fetch`:

```ts
const containedPath = path.resolve(resolvedPath);
if (containedPath !== path.resolve(appDir) &&
    !containedPath.startsWith(path.resolve(appDir) + path.sep)) {
  return new Response(null, { status: 404 });
}
return net.fetch(`file://${containedPath}`);
```

Keep the existing routed-response and fallback logic untouched.

**Verify**: `bun run dev:desktop` → app loads normally (dev mode may use the
dev server rather than app://; if so, ALSO run
`bun run build:desktop:unsigned` and launch the built app from
`apps/desktop/dist` to confirm the packaged shell renders — that path serves
via app://). Editor UI must appear and open a document.

### Step 3: Enable the sandbox

In `main-window-controller.ts` set `sandbox: true`. Then exercise every
preload-backed feature in the running desktop app:

1. App launches, editor renders (preload bridged `window.electron` exists —
   if it's undefined, the preload crashed; see STOP).
2. File open + save round-trip (`.punch`).
3. Recent documents menu populates.
4. Local fonts appear in the font picker.
5. App menu commands reach the renderer (e.g. New Document from the menu).
6. Updater code path doesn't throw on launch (check the main-process console).

**Verify**: all six checks pass in `bun run dev:desktop`, and the main process
logs contain no preload/sandbox errors.

### Step 4: Lint + smoke

**Verify**: `bun run check` → exit 0. If `bun run test:performance:desktop`
passed on the base commit (check first — it requires a built desktop app),
run it again → still passes.

## Test plan

No unit-test harness exists for `src-electron`; verification is the manual
checklist in Step 3 plus lint. (If a future plan adds a main-process test
harness, `isAllowedExternalUrl` and the containment branch are the first unit
tests to write — they're pure functions/branches by design.)

## Done criteria

- [ ] `sandbox: true` in main-window-controller.ts webPreferences
- [ ] Window-open handler rejects non-http(s)/mailto URLs; `grep -rn "openExternal" apps/desktop/src-electron` shows no unguarded dynamic-URL call
- [ ] serve-static-app.ts returns 404 for any resolved path outside appDir
- [ ] Step 3 manual checklist: all six items confirmed
- [ ] `bun run check` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- With `sandbox: true`, the preload fails to load or `window.electron` is
  undefined in the renderer — report the exact main-process error. Do NOT
  ship the other two fixes with sandbox silently reverted; either get explicit
  approval to land them separately or stop. (Most likely cause: a preload
  import that isn't sandbox-safe, e.g. a Node built-in beyond `process`.)
- Any preload-backed feature in Step 3 breaks (fonts, file dialogs, menus).
- The packaged app (Step 2 verification) renders a blank window after the
  containment change — the fallback path logic differs from this plan's
  reading; report.

## Maintenance notes

- Anyone adding a new external-link feature must route through
  `isAllowedExternalUrl`; reviewer should grep for new `openExternal` calls.
- If a future feature needs a new URL scheme (e.g. deep links), extend the
  allowlist deliberately, never inline.
- Adding new preload capabilities must stay sandbox-compatible
  (contextBridge + ipcRenderer only; no Node built-ins).
